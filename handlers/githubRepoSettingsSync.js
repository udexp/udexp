import { getOctokit } from '../lib/octokit'
import { syncLabels } from '../lib/labels'
import { log } from '../lib/logging'

const REPO_SETTINGS = JSON.parse(
  Buffer.from(process.env.REPO_SYNC_SETTINGS, 'base64').toString('utf8')
)

export async function githubRepoSettingsSync (event) {
  log(event)
  try {
    const octokit = await getOctokit()
    if (event.updateAllRepos) {
      const repoList = await octokit.rest.repos.listForOrg({
        org: event.updateAllRepos.org,
      })
      for (let repoObj of repoList) {
        await updateRepoSettings(octokit,
          { owner: event.updateAllRepos.org, repo: repoObj.name, org: event.updateAllRepos.org })
      }
    } else if (event.updateRepo) {
      await updateRepoSettings(octokit,
        { owner: event.updateRepo.org, repo: event.updateRepo.repo, org: event.updateRepo.org })
    } else {
      const data = event.body
      const owner = data.repository.owner.login
      const org = data.organization.login
      const repo = data.repository.name
      await updateRepoSettings(octokit, { owner, repo, org })
    }
  } catch (e) {
    console.log(e)
    throw e
  }
}

async function updateRepoSettings(octokit, { owner, repo, org }) {
  if (REPO_SETTINGS.labels) {
    await syncLabels(`${owner}/${repo}`, REPO_SETTINGS.labels)
    console.log(`${repo}: labels updated`)
  }
  if (REPO_SETTINGS.settings) {
    await octokit.rest.repos.update({
      owner,
      repo,
      ...REPO_SETTINGS.settings,
    })
    console.log(`${repo}: settings updated`)
  }
  if (REPO_SETTINGS.permissions) {
    await Promise.all(Object.keys(REPO_SETTINGS.permissions).map(async team => {
      await octokit.rest.teams.addOrUpdateRepoPermissionsInOrg({
        org,
        team_slug: team,
        owner,
        repo,
        permission: REPO_SETTINGS.permissions[team],
      })
      console.log(`${repo}: permission added for ${team}: ${REPO_SETTINGS.permissions[team]}`)
    }))
  }
}
