import { JsonTemplate } from '../lib/template'
import { SlackBot } from '../lib/slack'
import { log } from '../lib/logging'

const slackBot = new SlackBot({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
})

const reviewFinishedTemplate = new JsonTemplate('./templates/review_finished.json.tmpl')

async function sendMessage(reviewer, data) {
  if (reviewer === data.pull_request.user.login) {
    console.log(`Ignoring update from the PR author: ${reviewer}`)
    return
  }
  const reviewerSlack = await slackBot.getUserByGithub(reviewer)
  const authorSlack = await slackBot.getUserByGithub(data.pull_request.user.login)
  if (authorSlack) {
    data.slackUser = reviewerSlack ? reviewerSlack.data : { id: '' }
    switch(data.review.state) {
      case 'approved':
        data.review.icon = ':heavy_check_mark:'
        break
      case 'changes_requested':
        data.review.icon = ':x:'
        break
      case 'commented':
        data.review.icon = ':grey_question:'
        break
      default:
        data.review.icon = ''
    }
    const message = reviewFinishedTemplate.render(data)
    await slackBot.sendDM(authorSlack.data, message)
  } else {
    console.log(`Failed to find slack user for github login: ${data.pull_request.user.login}`)
  }
}

export async function githubReviewHandler (event, context) {
  log(event)
  const data = event.body
  if (['submitted', 'edited'].includes(event.action) && !['pending'].includes(data.review.state)) {
    await sendMessage(event.sender, data)
  }
}
