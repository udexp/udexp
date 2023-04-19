const uuid = require('uuid')
const { ResourceNotFoundException } = require('@aws-sdk/client-secrets-manager')
const { getUdexpSecret, loadConfig, loadDefaultConfig, saveConfig, getDefaultSchedule, saveUdexpSecret } = require('../cli/utils')

const defaultSecrets = {
  github: {
    webhookSecret: null,
    token: null,
  },
  slack: {
    token: null,
    signingSecret: null,
  },
  clickup: {
    apiKey: null,
    webhookSecret: null,
  },
}

module.exports = async ({ resolveVariable }) => {
  let dirty = false
  let config = await loadConfig()
  if (!config) {
    config = await loadDefaultConfig()
    dirty = true
  }
  if (!config?.github?.route) {
    config.github = { ...config.github, route: uuid.v4() }
    dirty = true
  }
  if (!config?.slack?.route) {
    config.slack = { ...config.slack, route: uuid.v4() }
    dirty = true
  }
  if (!config?.clickup?.route) {
    config.clickup = { ...config.clickup, route: uuid.v4() }
    dirty = true
  }
  if (config?.stalePR?.enabled && !config?.stalePR?.schedule) {
    config.stalePR = {
      ...config.stalePR,
      schedule: getDefaultSchedule(),
    }
    dirty = true
  }
  if (!config.secret) {
    let secretArn
    try {
      const response = await getUdexpSecret(config.region)
      secretArn = response.ARN
    } catch (e) {
      if (e instanceof ResourceNotFoundException) {
        const response = await saveUdexpSecret(config.region, defaultSecrets)
        secretArn = response.ARN
      } else {
        throw e
      }
    }
    config.secret = secretArn
    dirty = true
  }
  if (dirty) {
    await saveConfig(config)
  }
  return config
}
