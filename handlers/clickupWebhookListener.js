import crypto from 'crypto'
import { invoke } from '../lib/invoke'
import { log } from '../lib/logging'
import { getJSONSecret } from '../lib/secret'

const udexpSecret = process.env.UDEXP_SECRET

const DEFAULT = '_'

export async function clickupWebhookListener (event, context) {
  log(event)
  let errMsg // eslint-disable-line
  const headers = event.headers
  const sig = headers['x-signature'] || headers['X-Signature']
  const secret = (await getJSONSecret(udexpSecret)).clickup.webhookSecret
  const calculatedSig = signRequestBody(secret, event.body)

  if (!sig) {
    errMsg = 'No X-Signature found on request'
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    }
  }

  if (sig !== calculatedSig) {
    errMsg = 'X-Signature incorrect. Clickup webhook token doesn\'t match'
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    }
  }

  const payload = JSON.parse(event.body)

  const actions = payload.history_items.map(async item => {
    const data = {
      sender: item?.user?.email || DEFAULT,
      task_id: payload.task_id || DEFAULT,
      event: payload.event || DEFAULT,
      id: item.id,
      parent_id: item.parent_id || DEFAULT,
      epoch: Date.now() / 1000, // no requestTimeEpoch in nodejs lambda...
      body: item,
    }

    await invoke('clickupSaveTaskHandler', data)
  })
  const results = await Promise.allSettled(actions)
  console.log(results)
  return {
    statusCode: 200,
    body: JSON.stringify({}),
  }
}

function signRequestBody (key, body) {
  return crypto.createHmac('sha256', key).update(body).digest('hex')
}
