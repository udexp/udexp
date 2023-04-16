import { JsonTemplate } from './lib/template.js'

describe('test template render', () => {
  it('should render template successfully', () => {
    const readyForReviewTemplate = new JsonTemplate('./templates/new_pr.json.tmpl')
    const event = {
      repo: 'my_org/my_repo',
      sender: 'github_user',
      slackUser: {
        id: 'slack_id'
      },
      body: {
        pull_request: {
          title: 'aaa "aaa" `bbb` \'ccc\'',
          html_url: 'https://pull_request_url',
          user: {
            avatar_url: 'https://avatar_url',
            login: 'github_user'
          }
        }
      }
    }
    const message = readyForReviewTemplate.render(event)
    expect(message).toBeTruthy()
    console.log(JSON.stringify(message, null, 2))
  })
})
