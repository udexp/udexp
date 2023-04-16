import { App, AwsLambdaReceiver } from '@slack/bolt'
import { getJSONSecret } from './secret'

export class SlackBot {
  constructor (options) {
    this.options = options
    this.chanMap = {}
    this.app = null
    this.receiver = null
    this.actions = []
    this.teamFields = {}
    this.users = []
  }

  async sendMessage (channel, message) {
    const ch = await this.getChannel(channel)
    const options = {
      channel: ch.id,
    }
    if (message.blocks) {
      options.blocks = JSON.stringify(message.blocks)
    }
    if (message.text) {
      options.text = message.text
    }
    const res = await this.app.client.chat.postMessage(options)
    if (!res.ok) {
      throw new Error(`chat.postMessage: Error: ${res.error}`)
    }
  }

  async cacheNames () {
    if (!this.app) {
      await this.init()
    }
    const channels = (await this.app.client.conversations.list()).channels
    const map = {}
    channels.forEach(ch => {
      map[ch.name] = ch
    })
    this.chanMap = map
  }

  async cacheTeam () {
    if (!this.app) {
      await this.init()
    }
    const profile = (await this.app.client.team.profile.get()).profile
    const map = {}
    profile.fields.forEach(field => {
      map[field.label] = field
    })
    this.teamFields = map
  }

  async init () {
    const secrets = await getJSONSecret(this.options.secret)
    this.receiver = new AwsLambdaReceiver({
      signingSecret: secrets.slack.signingSecret,
    })

    this.app = new App({
      token: secrets.slack.token,
      receiver: this.receiver,
      processBeforeResponse: true
    })
    this.actions.forEach(item => {
      this.app.action(item.action, item.cb)
    })
    this.actions = []

    const members = await this.listUsers()
    this.users = members.map(member => {
      const user = new User(this, member.id)
      user.data = member
      return user
    })
  }

  async startListener () {
    if (!this.receiver) {
      await this.init()
    }
    return this.receiver.start()
  }

  onAction (action, cb) {
    if (!this.app) {
      this.actions.push({ action, cb })
    } else {
      this.app.action(action, cb)
    }
  }

  async processEvent (data) {
    if (!this.app) {
      await this.init()
    }
    const appEvent = {
      body: data,
      ack: () => {},
    }
    return this.app.processEvent(appEvent)
  }

  async getUserProfile (user_id) {
    if (!this.app) {
      await this.init()
    }
    const res = await this.app.client.users.profile.get({ user: user_id })
    if (!res.ok) {
      throw new Error(`users.profile.get: Error: ${res.error}`)
    }
    return res.profile
  }

  async getTeamField (name) {
    let field = this.teamFields[name]
    if (!field) {
      await this.cacheTeam()
      field = this.teamFields[name]
      if (!field) {
        throw new Error(`Field not found: ${name}`)
      }
    }
    return field
  }

  user (user_id) {
    return new User(this, user_id)
  }

  async getUserByGithub (githubName) {
    if (this.users.length < 1) {
      await this.init()
    }
    for (let i = 0; i < this.users.length; i++) {
      const user = this.users[i]
      const userGithubName = await user.getField('GitHub')
      if (githubName === userGithubName) {
        return user
      }
    }
  }

  async listUsers () {
    if (!this.app) {
      await this.init()
    }
    const limit = 200
    let res = await this.app.client.users.list({ limit })
    if (!res.ok) {
      throw new Error(`users.list: Error: ${res.error}`)
    }
    const members = res.members
    while (res.response_metadata?.next_cursor) {
      res = await this.app.client.users.list({ limit, cursor: res.response_metadata.next_cursor })
      if (!res.ok) {
        throw new Error(`users.list: Error: ${res.error}`)
      }
      members.push(res.members)
    }
    return members
  }

  async getChannel(channel) {
    if (!this.app) {
      await this.init()
    }
    let ch = this.chanMap[channel]
    if (!ch) {
      await this.cacheNames()
      ch = this.chanMap[channel]
      if (!ch) {
        throw new Error(`Channel not found: ${channel}`)
      }
    }
    return ch
  }

  async sendDM(users, message) {
    if (!Array.isArray(users)) {
      users = [users]
    }
    let res = await this.app.client.conversations.open({
      users: users.map(user => user.id).join(','),
    })
    if (!res.ok) {
      throw new Error(`conversations.open: Error: ${res.error}`)
    }
    const options = {
      channel: res.channel.id,
    }
    if (message.blocks) {
      options.blocks = JSON.stringify(message.blocks)
    }
    if (message.text) {
      options.text = message.text
    }
    res = await this.app.client.chat.postMessage(options)
    if (!res.ok) {
      throw new Error(`chat.postMessage: Error: ${res.error}`)
    }
  }
}

class User {
  constructor (slackBot, user_id) {
    this.slackBot = slackBot
    this.id = user_id
    this.profile = null
    this.data = null
  }

  async getField (name) {
    if (!this.profile) {
      await this.cacheProfile()
    }
    if (this.profile.fields) {
      const field = await this.slackBot.getTeamField(name)
      const profileField = this.profile.fields[field.id]
      if (profileField) {
        return profileField.value
      }
    }
    return null
  }

  async cacheProfile () {
    this.profile = await this.slackBot.getUserProfile(this.id)
  }
}
