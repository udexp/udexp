import fetch from 'node-fetch'
import { DB } from '../lib/storage'
import { log } from '../lib/logging'
import { getJSONSecret } from '../lib/secret'

const udexpSecret = process.env.UDEXP_SECRET
const dbConn = new DB({
  database: process.env.DATA_API_DATABASE_NAME,
  resourceArn: process.env.DATA_API_RESOURCE_ARN,
  secretArn: process.env.DATA_API_SECRET_ARN,
})

const CLICKUP_ORG_ID = process.env.CLICKUP_ORG_ID
const TASK_URL = `https://app.clickup.com/t/${CLICKUP_ORG_ID}/`

export async function clickupSaveTaskHandler (event, context) {
  log(event)
  const data = event
  try {
    const key = (await getJSONSecret(udexpSecret)).clickup.apiKey
    const res = await fetch(`https://api.clickup.com/api/v2/task/${data.task_id}`, {
      headers: {
        Authorization: key,
      }
    })
    const task_data = await res.json()
    data.body.task_data = task_data
    data.custom_id = task_data.custom_id
    data.name = task_data.name
    await dbConn.updateTaskList(data, TASK_URL)
    await dbConn.insertTaskEvent(data)
  } catch (e) {
    console.log(e)
  }
}
