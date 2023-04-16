import { backportPullRequest } from '../lib/backport'
import { getOctokit } from '../lib/octokit'
import { Labeler } from '../lib/labeler'
import { log } from '../lib/logging'

const backportLabelRe = /backport\s+to.*\s+(\S+)$/i

export async function githubMergeBot (event, context) {
  log(event)
  try {
    const octokit = await getOctokit()
    const data = event.body
    const pull_request = data.pull_request
    const owner = data.repository.owner.login
    const repo = data.repository.name
    const issue = pull_request.number

    const createComment = async (message) => {
      return octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issue,
        body: message,
      })
    }

    const { data: allLabels } = await octokit.rest.issues.listLabelsOnIssue({
      owner,
      repo,
      issue_number: issue,
    })

    let labels
    if (event.action === 'labeled') {
      labels = [data.label]
    } else {
      labels = allLabels
    }
    const backportBranches = labels.reduce((result, label) => {
      const match = label.name.match(backportLabelRe)
      if (match) {
        return result.concat(match[1])
      }
      return result
    }, [])

    if (backportBranches && backportBranches.length > 0) {
      let labelsToAdd = allLabels.filter(label => {
        if (!label.name.match(backportLabelRe)) {
          return label.name
        }
      })
      labelsToAdd.push('ready for review')

      await createComment(`Will backport this PR to: ${backportBranches.map(b => `**${b}**`).join(', ')}`)
      const results = await Promise.allSettled(backportBranches.map(async (branch) => {
        const newPrNumber = await backportPullRequest({
          base: branch,
          body: `Backport of #${issue} from ${pull_request.base.ref}`,
          head: `backport-${issue}-to-${branch}`,
          octokit,
          owner,
          repo,
          pullRequestNumber: issue,
        })
        await createComment(`Created a backport PR #${newPrNumber} for ${branch}`)
        const labeler = new Labeler(octokit, {
          owner,
          repo,
          issue_number: newPrNumber,
        })
        await labeler.addLabels(labelsToAdd)
      }))
      await Promise.allSettled(results.map(async (res) => {
        console.log(res)
        if (res.status === 'rejected') {
          await createComment(`${res.reason}`)
        }
      }))
    }
  } catch (e) {
    console.log(e)
    throw e
  }
}
