import { getOctokit } from '../lib/octokit'
import { DB } from '../lib/storage'
import { log } from '../lib/logging'

const dbConn = new DB({
  database: process.env.DATA_API_DATABASE_NAME,
  resourceArn: process.env.DATA_API_RESOURCE_ARN,
  secretArn: process.env.DATA_API_SECRET_ARN,
})

// check no more than MAX_REGEX tasks each time
// helps do divide and conquer
const MAX_REGEX = 100

function getChunk (tasks, chunk_idx) {
  return tasks.slice(chunk_idx * MAX_REGEX, (chunk_idx + 1) * MAX_REGEX)
}

function matchTasks (dataString, tasks) {
  for (let i = 0, check; (check = getChunk(tasks, i)).length > 0; i++) {
    const pattern = new RegExp(check.map(t => t + '(?=[^0-9])').join("|"))
    const match = pattern.exec(dataString)
    if (match) {
      return match[0]
    }
  }
  return null
}

export async function githubLinkClickup (event, context) {
  log(event)
  try {
    const data = event.body
    const tasks = await dbConn.getAllTasks()
    let commits = []
    const pull_request = data.pull_request
    if (pull_request) {
      const taskId = matchTasks(JSON.stringify(pull_request), tasks)
      if (taskId) {
        const owner = data.repository.owner.login
        const repo = data.repository.name
        const pull_number = data.pull_request.number
        const octokit = await getOctokit()
        const { data: prCommits } = await octokit.rest.pulls.listCommits({
          owner,
          repo,
          pull_number,
        })
        commits = prCommits.map(item => ([
          { name: 'commit', value: { stringValue: item.sha }},
          { name: 'custom_id', value: { stringValue: taskId }},
        ]))
      }
    } else if (Array.isArray(data.commits)) {
      commits = data.commits.reduce((res, item, ) => {
        const taskId = matchTasks(item.message, tasks)
        if (taskId) {
          res.push([
            { name: 'commit', value: { stringValue: item.id }},
            { name: 'custom_id', value: { stringValue: taskId }},
          ])
        }
        return res
      }, [])
    }
    if (commits.length > 0) {
      await dbConn.insertCommitMappings(commits)
    }
  } catch (e) {
    console.log(e)
    throw e
  }
}
