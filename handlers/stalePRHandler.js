import { SlackBot } from "../lib/slack"
import { DB } from "../lib/storage"

const slackBot = new SlackBot({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
})

const dbConn = new DB({
  database: process.env.DATA_API_DATABASE_NAME,
  resourceArn: process.env.DATA_API_RESOURCE_ARN,
  secretArn: process.env.DATA_API_SECRET_ARN,
  includeResultMetadata: true,
})

const stalePRStart = process.env.STALE_PR_START
const stalePRHistory = process.env.STALE_PR_HISTORY
const reviewChannel = process.env.SLACK_PR_CHANNEL

export async function stalePRHandler () {
  try {
    const res = await dbConn.sql(`
        with pending as (
            with opened as (
                select ts,
                       action,
                       body -> 'pull_request' ->> 'html_url'                                 as url,
                       body -> 'pull_request' ->> 'title'                                    as title,
                       repo,
                       ((body -> 'pull_request' ->> 'merged')::boolean or action = 'closed') as done
                from events
                where type = 'pull_request'
                  and (
                      (action = 'opened' and
                       body -> 'pull_request' -> 'labels' @> '["ready for review"]'::jsonb)
                    or
                      (action in ('labeled', 'unlabeled') and
                       body -> 'label' ->> 'name' = 'ready for review')
                    or
                       action = 'closed'
                    or
                       (body -> 'pull_request' ->> 'merged')::boolean = true
                  )
            )
            select url,
                   max(title) as title,
                   max(repo) as repo, 
                   max(ts) as ts,
                   sum(case when (action in ('opened', 'labeled')) then 1 else 0 end) as labeled,
                   sum(case when (action in ('unlabeled')) then 1 else 0 end) as unlabeled,
                   bool_or(done) as closed
            from opened
            group by url
        )
        select repo,
               title,
               url
        from pending
        where labeled > unlabeled
          and closed = false
          and ts > (now() - '${stalePRHistory}'::interval)
          and ts < (now() - '${stalePRStart}'::interval)
    `)
    const rows = res.records.map(item => ({
      repo: item[0].stringValue,
      title: item[1].stringValue,
      url: item[2].stringValue,
    }))
    if (rows.length > 0) {
      const blocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "Stale un-merged PRs:"
          }
        },
      ]
      rows.forEach(row => {
        blocks.push(
          {
            type: "divider"
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: ":pr-green:"
              },
              {
                type: "mrkdwn",
                text: row.repo
              }
            ]
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${row.title}*`
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `<${row.url}>`
            }
          },
        )
      })
      const message = {
        text: `Stale PRs found: ${rows.map(row => row.url).join(" ")}`,
        blocks,
      }
      await slackBot.sendMessage(reviewChannel, message)
    } else {
      console.log("No stale PRs found")
    }
  } catch (e) {
    console.log(e)
    throw e
  }
}