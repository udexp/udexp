import { getOctokit, getOctokitGraphql } from '../lib/octokit'
import { hasReadyForReviewLabel, Labeler } from '../lib/labeler'
import { log } from '../lib/logging'
import { getJSONSecret } from '../lib/secret'

const udexpSecret = process.env.UDEXP_SECRET

export async function githubPRHandler (event, context) {
  log(event)
  const githubToken = (await getJSONSecret(udexpSecret)).github.token
  const octokit = getOctokit(githubToken)
  const graphql = getOctokitGraphql(githubToken)
  const data = event.body
  const labeler = new Labeler(octokit, {
    owner: data.repository.owner.login,
    repo: data.repository.name,
    issue_number: data.pull_request.number,
  })
  switch (event.type) {
    case 'pull_request':
      switch (event.action) {
        case 'opened':
        case 'reopened':
          const labels = data.pull_request.labels
          if (data.pull_request.draft) {
            await labeler.addLabels('WIP')
            await labeler.removeLabels('ready for review')
          } else if (event.action === 'opened' && !hasReadyForReviewLabel(labels)) {
            await toDraft(graphql, data.pull_request.node_id)
          }
          break
        case 'converted_to_draft':
          await labeler.addLabels('WIP')
          await labeler.removeLabels('ready for review')
          break
        case 'ready_for_review':
          await labeler.addLabels('ready for review')
          await labeler.removeLabels('WIP')
          break
        case 'closed':
          await labeler.removeLabels('ready for review')
          await labeler.removeLabels('WIP')
          break
      }
      break
    case 'pull_request_review':
      if (['approved', 'changes_requested'].includes(data.review.state)) {
        await labeler.removeLabels('ready for review')
      }
      break
  }
}

async function toDraft(graphql, id) {
  await graphql(`
    mutation($id: ID!) {
      convertPullRequestToDraft(input: {pullRequestId: $id}) {
        pullRequest {
          id
          number
        }
      }
    }
    `,
      {
        id
      }
  )
}
