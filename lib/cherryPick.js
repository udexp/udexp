import * as createDebug from 'debug'
import {
  fetchRefSha,
  updateRef,
  withTemporaryRef,
} from './git'

const debug = createDebug('github-cherry-pick')

// See https://github.com/tibdex/github-rebase/issues/13
const getCommitMessageToSkipCI = (title) =>
  `${title} [skip ci]


skip-checks: true
`

const createCommit = async ({
  author,
  committer,
  message,
  octokit,
  owner,
  parent,
  repo,
  tree,
}) => {
  const { data: { sha } } = await octokit.git.createCommit({
    author,
    committer,
    message,
    owner,
    parents: [parent],
    repo,
    // No PGP signature support for now.
    // See https://developer.github.com/v3/git/commits/#create-a-commit.
    tree,
  })
  return sha
}

const merge = async ({
  base,
  commit,
  octokit,
  owner,
  repo,
}) => {
  const {
    data: {
      commit: {
        tree: { sha: tree },
      },
    },
  } = await octokit.repos.merge({
    base,
    commit_message: getCommitMessageToSkipCI(`Merge ${commit} into ${base}`),
    head: commit,
    owner,
    repo,
  })
  return tree
}

const retrieveCommitDetails = async ({
  commit,
  octokit,
  owner,
  repo,
}) => {
  const {
    data: { author, committer, message, parents },
  } = await octokit.git.getCommit({
    commit_sha: commit,
    owner,
    repo,
  })
  if (parents.length > 1) {
    throw new Error(
      `Commit ${commit} has ${parents.length} parents.` +
      ' github-cherry-pick is designed for the rebase workflow and doesn\'t support merge commits.',
    )
  }
  return { author, committer, message, parent: parents[0].sha }
}

const createSiblingCommit = async ({
  commit,
  head: { author, committer, ref, tree },
  octokit,
  owner,
  parent,
  repo,
}) => {
  const sha = await createCommit({
    author,
    committer,
    message: getCommitMessageToSkipCI(`Sibling of ${commit}`),
    octokit,
    owner,
    parent,
    repo,
    tree,
  })
  await updateRef({
    force: true,
    octokit,
    owner,
    ref,
    repo,
    sha,
  })
}

const cherryPickCommit = async ({
  commit,
  head: { ref, sha, tree },
  octokit,
  owner,
  repo,
}) => {
  const { author, committer, message, parent } = await retrieveCommitDetails({
    commit,
    octokit,
    owner,
    repo,
  })
  debug('creating sibling commit')
  await createSiblingCommit({
    commit,
    head: { author, committer, ref, tree },
    octokit,
    owner,
    parent,
    repo,
  })
  debug('merging')
  const newHeadTree = await merge({
    base: ref,
    commit,
    octokit,
    owner,
    repo,
  })
  debug('creating commit with different tree', newHeadTree)
  const newHeadSha = await createCommit({
    author,
    committer,
    message,
    octokit,
    owner,
    parent: sha,
    repo,
    tree: newHeadTree,
  })
  debug('updating ref', newHeadSha)
  await updateRef({
    // Overwrite the merge commit and its parent on the branch by a single commit.
    // The result will be equivalent to what would have happened with a fast-forward merge.
    force: true,
    octokit,
    owner,
    ref,
    repo,
    sha: newHeadSha,
  })
  return {
    sha: newHeadSha,
    tree: newHeadTree,
  }
}

const cherryPickCommitsOnRef = async ({
  commits,
  initialHeadSha,
  octokit,
  owner,
  ref,
  repo,
}) => {
  const {
    data: {
      tree: { sha: initialHeadTree },
    },
  } = await octokit.git.getCommit({
    commit_sha: initialHeadSha,
    owner,
    repo,
  })

  const { sha: newHeadSha } = await commits.reduce(
    async (previousCherryPick, commit) => {
      const { sha, tree } = await previousCherryPick
      debug('cherry-picking', { commit, ref, sha })
      return cherryPickCommit({
        commit,
        head: { ref, sha, tree },
        octokit,
        owner,
        repo,
      })
    },
    Promise.resolve({
      sha: initialHeadSha,
      tree: initialHeadTree,
    }),
  )

  return newHeadSha
}

// eslint-disable-next-line max-lines-per-function
const cherryPickCommits = async ({
  _intercept = () => Promise.resolve(),
  commits,
  head,
  octokit,
  owner,
  repo,
}) => {
  debug('starting', { commits, head, owner, repo })
  const initialHeadSha = await fetchRefSha({
    octokit,
    owner,
    ref: head,
    repo,
  })
  await _intercept({ initialHeadSha })
  return withTemporaryRef({
    action: async temporaryRef => {
      debug({ temporaryRef })
      const newSha = await cherryPickCommitsOnRef({
        commits,
        initialHeadSha,
        octokit,
        owner,
        ref: temporaryRef,
        repo,
      })
      debug('updating ref with new SHA', newSha)
      await updateRef({
        // Make sure it's a fast-forward update.
        force: false,
        octokit,
        owner,
        ref: head,
        repo,
        sha: newSha,
      })
      debug('ref updated')
      return newSha
    },
    octokit,
    owner,
    ref: `cherry-pick-${head}`,
    repo,
    sha: initialHeadSha,
  })
}

export { cherryPickCommits }
