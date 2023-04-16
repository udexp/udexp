import crypto from 'crypto'

import { getJSONSecret } from '../lib/secret'
import { Invoker } from '../lib/invoke'
import { DB } from '../lib/storage'
import { SqsExecute } from '../lib/sqs'
import { log } from '../lib/logging'

const DEFAULT = '_'

const dbConn = new DB({
  database: process.env.DATA_API_DATABASE_NAME,
  resourceArn: process.env.DATA_API_RESOURCE_ARN,
  secretArn: process.env.DATA_API_SECRET_ARN,
})
const udexpSecret = process.env.UDEXP_SECRET
const reviewFlow = process.env.GITHUB_REVIEW_FLOW
const clickupEnabled = process.env.CLICKUP_ENABLED === 'true'

export async function githubWebhookListener (event, context) {
  log(event)
  return SqsExecute(event, async (event) => {
    let errMsg // eslint-disable-line
    const token = (await getJSONSecret(udexpSecret)).github.webhookSecret
    const headers = event.headers
    const sig = headers['x-hub-signature']
    const githubEvent = headers['x-github-event']
    const id = headers['x-gitHub-delivery']
    const calculatedSig = signRequestBody(token, event.body)

    if (typeof token !== 'string') {
      errMsg = 'Cannot find github.webhookSecret'
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'text/plain' },
        body: errMsg,
      }
    }

    if (!sig) {
      errMsg = 'No X-Hub-Signature found on request'
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'text/plain' },
        body: errMsg,
      }
    }

    if (!githubEvent) {
      errMsg = 'No X-Github-Event found on request'
      return {
        statusCode: 422,
        headers: { 'Content-Type': 'text/plain' },
        body: errMsg,
      }
    }

    if (!id) {
      errMsg = 'No X-Github-Delivery found on request'
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'text/plain' },
        body: errMsg,
      }
    }

    if (sig !== calculatedSig) {
      errMsg = 'X-Hub-Signature incorrect. Github webhook token doesn\'t match'
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'text/plain' },
        body: errMsg,
      }
    }

    const payload = JSON.parse(event.body)

    const data = {
      sender: payload.sender?.login || DEFAULT,
      repo: payload.repository?.full_name || DEFAULT,
      action: payload.action || DEFAULT,
      type: githubEvent || DEFAULT,
      delivery: id,
      epoch: Date.now() / 1000, // no requestTimeEpoch in nodejs lambda...
      body: payload,
    }

    const invoker = new Invoker()
    switch (data.type) {
      case 'pull_request':
        const pull_request = data.body.pull_request
        if (reviewFlow === 'draft') {
          invoker.start('githubPRHandler', data)
        }
        if (pull_request.merged && ['labeled', 'closed'].includes(data.action)) {
          invoker.start('githubMergeBot', data)
          if (clickupEnabled) {
            invoker.start('githubLinkClickup', data)
          }
        }
        switch (data.action) {
          case 'labeled':
          case 'unlabeled':
            invoker.start('githubLabelHandler', data)
            break
          case 'opened':
            if (Array.isArray(pull_request.labels) && pull_request.labels.length > 0) {
              invoker.start('githubLabelHandler', data)
            }
            break
        }
        break
      case 'pull_request_review':
        invoker.start('githubPRHandler', data)
        invoker.start('githubReviewHandler', data)
        break
      case 'push':
        if (clickupEnabled) {
          invoker.start('githubLinkClickup', data)
        }
        break
      case 'repository':
        switch (data.action) {
          case 'created':
            invoker.start('githubRepoSettingsSync', data)
            break
        }
        break
    }
    await invoker.flush()

    try {
      await dbConn.insertEvent(data)
    } catch (e) {
      return {
        statusCode: 500,
        body: JSON.stringify(e),
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({}),
    }
  })
}

function signRequestBody (key, body) {
  return `sha1=${crypto.createHmac('sha1', key).update(body, 'utf-8').digest('hex')}`
}
