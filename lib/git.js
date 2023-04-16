import { v4 as uuidv4 } from 'uuid'

const generateUniqueRef = (ref) => `${ref}-${uuidv4()}`
const getHeadRef = (ref) => `heads/${ref}`
const getFullyQualifiedRef = (ref) => `refs/${getHeadRef(ref)}`

const fetchRefSha = async ({
  octokit,
  owner,
  ref,
  repo,
}) => {
  const {
    data: {
      object: { sha },
    },
  } = await octokit.git.getRef({
    owner,
    ref: getHeadRef(ref),
    repo,
  })
  return sha
}

const updateRef = async ({
  force,
  octokit,
  owner,
  ref,
  repo,
  sha,
}) => {
  await octokit.git.updateRef({
    force,
    owner,
    ref: getHeadRef(ref),
    repo,
    sha,
  })
}

const deleteRef = async ({
  octokit,
  owner,
  ref,
  repo,
}) => {
  await octokit.git.deleteRef({
    owner,
    ref: getHeadRef(ref),
    repo,
  })
}

const createRef = async ({
  octokit,
  owner,
  ref,
  repo,
  sha,
}) => {
  await octokit.git.createRef({
    owner,
    ref: getFullyQualifiedRef(ref),
    repo,
    sha,
  })
}

const createTemporaryRef = async ({
  octokit,
  owner,
  ref,
  repo,
  sha,
}) => {
  const temporaryRef = generateUniqueRef(ref)
  await createRef({
    octokit,
    owner,
    ref: temporaryRef,
    repo,
    sha,
  })
  return {
    async deleteTemporaryRef () {
      await deleteRef({
        octokit,
        owner,
        ref: temporaryRef,
        repo,
      })
    },
    temporaryRef,
  }
}

const withTemporaryRef = async ({
  action,
  octokit,
  owner,
  ref,
  repo,
  sha,
}) => {
  const { deleteTemporaryRef, temporaryRef } = await createTemporaryRef({
    octokit,
    owner,
    ref,
    repo,
    sha,
  })

  try {
    return await action(temporaryRef)
  } finally {
    await deleteTemporaryRef()
  }
}

const getCommitsDetails = ({
  commit: {
    author,
    committer,
    message,
    tree: { sha: tree },
  },
  sha,
}) => ({
  author,
  committer,
  message,
  sha,
  tree,
})

const fetchCommitsDetails = async ({
  octokit,
  owner,
  pullRequestNumber,
  repo,
}) => {
  const options = octokit.pulls.listCommits.endpoint.merge({
    owner,
    pull_number: pullRequestNumber,
    repo,
  })
  const commits = await octokit.paginate(options)
  return commits.map(getCommitsDetails)
}

const fetchCommits = async ({
  octokit,
  owner,
  pullRequestNumber,
  repo,
}) => {
  const details = await fetchCommitsDetails({
    octokit,
    owner,
    pullRequestNumber,
    repo,
  })
  return details.map(({ sha }) => sha)
}

export {
  createRef,
  createTemporaryRef,
  deleteRef,
  fetchCommits,
  fetchCommitsDetails,
  fetchRefSha,
  generateUniqueRef,
  getHeadRef,
  updateRef,
  withTemporaryRef,
}
