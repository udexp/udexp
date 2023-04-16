import { SlackBot } from '../lib/slack'
import { log } from '../lib/logging'

const slackBot = new SlackBot({
  secret: process.env.UDEXP_SECRET,
})

slackBot.onAction('review/start', async (event) => {
  const { body, respond } = event
  console.log('review/start event', event)
  const user = slackBot.user(body.user.id)
  const githubName = await user.getField('GitHub')
  console.log('user', user.profile)
  const blocks = body.message.blocks
  addReview(blocks, body.user.id, githubName)
  await respond({ blocks, replace_original: true })
})

export async function slackInteractionListener (event, context) {
  log(event)
  await slackBot.startListener()
  const promises = event.Records.map(record => {
    console.log('record', record)
    return slackBot.processEvent(parseRecord(record).body)
  })
  return Promise.all(promises)
}

function parseRecord (record) {
  const PAYLOAD = 'payload'

  if (!record.body) {
    throw new Error(`No "body" property in record: ${JSON.stringify(record)}`)
  }
  if (record.body.startsWith(`${PAYLOAD}=`)) {
    const params = new URLSearchParams(record.body)
    record.body = JSON.parse(params.get('payload'))
  }
  return record
}

function addReview (blocks, user_id, githubName) {
  const reviewText = `Review started by <@${user_id}> (*${githubName}*)`
  const hasReview = blocks.find(block => {
    if (block.type === 'context' && block.elements) {
      if (block.elements.find(el => el.text === reviewText)) {
        return true
      }
    }
  })
  if (!hasReview) {
    blocks.splice(-1, 0, {
      'type': 'context',
      'elements': [
        {
          'type': 'mrkdwn',
          'text': reviewText
        }
      ]
    })
  }
}
