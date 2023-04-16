import * as createDebug from 'debug'
import { createRef, deleteRef, fetchCommits, fetchRefSha } from './git'
import { cherryPickCommits } from './cherryPick'

const debug = createDebug('github-backport')

const backportPullRequest = async ({
  // Should only be used in tests.
  _intercept = () => Promise.resolve(),
  base,
  body: givenBody,
  head: givenHead,
  octokit,
  owner,
  pullRequestNumber,
  repo,
  title: givenTitle,
}) => {
  const {
    data: { title: originalTitle },
  } = await octokit.pulls.get({
    owner,
    pull_number: pullRequestNumber,
    repo,
  })

  const {
    body = `Backport #${pullRequestNumber}.`,
    head = `backport-${pullRequestNumber}-to-${base}`,
    title = `[Backport ${base}] ${originalTitle}`,
  } = { body: givenBody, head: givenHead, title: givenTitle }

  debug('starting', {
    base,
    body,
    head,
    owner,
    pullRequestNumber,
    repo,
    title,
  })

  const baseSha = await fetchRefSha({
    octokit,
    owner,
    ref: base,
    repo,
  })

  debug('fetching commits')
  const commits = await fetchCommits({
    octokit,
    owner,
    pullRequestNumber,
    repo,
  })

  debug('creating reference')
  await createRef({
    octokit,
    owner,
    ref: head,
    repo,
    sha: baseSha,
  })
  debug('reference created')

  await _intercept({ commits })

  try {
    try {
      debug('cherry-picking commits', commits)
      const headSha = await cherryPickCommits({
        commits,
        head,
        octokit,
        owner,
        repo,
      })
      debug('commits cherry-picked', headSha)
    } catch (error) {
      debug('commits could not be cherry-picked', error)
      throw new Error(
        `Commits could not be cherry-picked on top of **${base}**
${commits.map(c => `- ${c}`).join('\n')}`,
      )
    }
    debug('creating pull request')
    const {
      data: { number: backportedPullRequestNumber },
    } = await octokit.pulls.create({
      base,
      body,
      head,
      owner,
      repo,
      title,
    })
    debug('pull request created', backportedPullRequestNumber)
    return backportedPullRequestNumber
  } catch (error) {
    debug('rollbacking reference creation', error)
    await deleteRef({ octokit, owner, ref: head, repo })
    debug('reference creation rollbacked')
    throw error
  }
}

export { backportPullRequest }
