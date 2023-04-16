import { SlackBot } from '../lib/slack'
import { JsonTemplate } from '../lib/template'
import { hasReadyForReviewLabel } from '../lib/labeler'
import { log } from '../lib/logging'

const readyForReviewTemplate = new JsonTemplate('./templates/new_pr.json.tmpl')

const slackBot = new SlackBot({
  secret: process.env.UDEXP_SECRET,
})

const reviewChannel = process.env.SLACK_PR_CHANNEL

async function sendMessage(author, event) {
  const slackUser = await slackBot.getUserByGithub(author)
  event.slackUser = slackUser ? slackUser.data : { id: '' }
  const message = readyForReviewTemplate.render(event)
  await slackBot.sendMessage(reviewChannel, message)
}

export async function githubLabelHandler (event, context) {
  log(event)
  const data = event.body
  const pr = data.pull_request.html_url
  const author = data.pull_request.user.login
  switch (event.action) {
    case 'labeled': {
      const label = data.label.name
      console.log(`PR ${pr} was ${event.action} with "${label}" by "${event.sender}"`)
      if (hasReadyForReviewLabel(label)) {
        await sendMessage(author, event)
      }
      break
    }
    case 'unlabeled': {
      const label = data.label.name
      console.log(`PR ${pr} was ${event.action} with "${label}" by "${event.sender}"`)
      break
    }
    case 'opened': {
      const labels = data.pull_request.labels
      console.log(`PR ${pr} was ${event.action} with: ${JSON.stringify(labels).slice(1, -1)} by "${event.sender}"`)
      if (hasReadyForReviewLabel(labels)) {
        await sendMessage(author, event)
      }
      break
    }
  }
}
