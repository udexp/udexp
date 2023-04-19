const { SecretsManagerClient, GetSecretValueCommand, CreateSecretCommand, PutSecretValueCommand } = require('@aws-sdk/client-secrets-manager')
const { resolve } = require('node:path')
const { access, constants, readFile, writeFile } = require('node:fs/promises')
const { safeLoad, safeDump } = require('js-yaml')

const secretId = 'udexp-config-secrets'
const cron = 'cron(MINUTES 12 ? * MON-FRI *)'

async function getUdexpSecret(region) {
  const client = new SecretsManagerClient({ region })
  const command = new GetSecretValueCommand({ SecretId: secretId })
  return client.send(command)
}

async function createUdexpSecret(region, data) {
  const client = new SecretsManagerClient({ region })
  const command = new CreateSecretCommand({
    Name: secretId,
    SecretString: JSON.stringify(data),
  })
  return client.send(command)
}

async function updateUdexpSecret(region, data) {
  const client = new SecretsManagerClient({ region })
  const command = new PutSecretValueCommand({
    SecretId: secretId,
    SecretString: JSON.stringify(data),
  })
  return client.send(command)
}

const regionList = [
  {
    'name': 'N. Virginia',
    'full_name': 'US East (N. Virginia)',
    'code': 'us-east-1',
    'public': true,
    'zones': [
      'us-east-1a',
      'us-east-1b',
      'us-east-1c',
      'us-east-1d',
      'us-east-1e',
      'us-east-1f'
    ]
  },
  {
    'name': 'Ohio',
    'full_name': 'US East (Ohio)',
    'code': 'us-east-2',
    'public': true,
    'zones': [
      'us-east-2a',
      'us-east-2b',
      'us-east-2c'
    ]
  },
  {
    'name': 'N. California',
    'full_name': 'US West (N. California)',
    'code': 'us-west-1',
    'public': true,
    'zone_limit': 2,
    'zones': [
      'us-west-1a',
      'us-west-1b',
      'us-west-1c'
    ]
  },
  {
    'name': 'Oregon',
    'full_name': 'US West (Oregon)',
    'code': 'us-west-2',
    'public': true,
    'zones': [
      'us-west-2a',
      'us-west-2b',
      'us-west-2c',
      'us-west-2d'
    ]
  },
  {
    'name': 'GovCloud West',
    'full_name': 'AWS GovCloud (US)',
    'code': 'us-gov-west-1',
    'public': false,
    'zones': [
      'us-gov-west-1a',
      'us-gov-west-1b',
      'us-gov-west-1c'
    ]
  },
  {
    'name': 'GovCloud East',
    'full_name': 'AWS GovCloud (US-East)',
    'code': 'us-gov-east-1',
    'public': false,
    'zones': [
      'us-gov-east-1a',
      'us-gov-east-1b',
      'us-gov-east-1c'
    ]
  },
  {
    'name': 'Canada',
    'full_name': 'Canada (Central)',
    'code': 'ca-central-1',
    'public': true,
    'zones': [
      'ca-central-1a',
      'ca-central-1b',
      'ca-central-1c',
      'ca-central-1d'
    ]
  },
  {
    'name': 'Stockholm',
    'full_name': 'EU (Stockholm)',
    'code': 'eu-north-1',
    'public': true,
    'zones': [
      'eu-north-1a',
      'eu-north-1b',
      'eu-north-1c'
    ]
  },
  {
    'name': 'Ireland',
    'full_name': 'EU (Ireland)',
    'code': 'eu-west-1',
    'public': true,
    'zones': [
      'eu-west-1a',
      'eu-west-1b',
      'eu-west-1c'
    ]
  },
  {
    'name': 'London',
    'full_name': 'EU (London)',
    'code': 'eu-west-2',
    'public': true,
    'zones': [
      'eu-west-2a',
      'eu-west-2b',
      'eu-west-2c'
    ]
  },
  {
    'name': 'Paris',
    'full_name': 'EU (Paris)',
    'code': 'eu-west-3',
    'public': true,
    'zones': [
      'eu-west-3a',
      'eu-west-3b',
      'eu-west-3c'
    ]
  },
  {
    'name': 'Frankfurt',
    'full_name': 'EU (Frankfurt)',
    'code': 'eu-central-1',
    'public': true,
    'zones': [
      'eu-central-1a',
      'eu-central-1b',
      'eu-central-1c'
    ]
  },
  {
    'name': 'Milan',
    'full_name': 'EU (Milan)',
    'code': 'eu-south-1',
    'public': true,
    'zones': [
      'eu-south-1a',
      'eu-south-1b',
      'eu-south-1c'
    ]
  },
  {
    'name': 'Cape Town',
    'full_name': 'Africa (Cape Town)',
    'code': 'af-south-1',
    'public': true,
    'zones': [
      'af-south-1a',
      'af-south-1b',
      'af-south-1c'
    ]
  },
  {
    'name': 'Tokyo',
    'full_name': 'Asia Pacific (Tokyo)',
    'code': 'ap-northeast-1',
    'public': true,
    'zone_limit': 3,
    'zones': [
      'ap-northeast-1a',
      'ap-northeast-1b',
      'ap-northeast-1c',
      'ap-northeast-1d'
    ]
  },
  {
    'name': 'Seoul',
    'full_name': 'Asia Pacific (Seoul)',
    'code': 'ap-northeast-2',
    'public': true,
    'zones': [
      'ap-northeast-2a',
      'ap-northeast-2b',
      'ap-northeast-2c',
      'ap-northeast-2d'
    ]
  },
  {
    'name': 'Osaka',
    'full_name': 'Asia Pacific (Osaka-Local)',
    'code': 'ap-northeast-3',
    'public': true,
    'zones': [
      'ap-northeast-3a',
      'ap-northeast-3b',
      'ap-northeast-3c'
    ]
  },
  {
    'name': 'Singapore',
    'full_name': 'Asia Pacific (Singapore)',
    'code': 'ap-southeast-1',
    'public': true,
    'zones': [
      'ap-southeast-1a',
      'ap-southeast-1b',
      'ap-southeast-1c'
    ]
  },
  {
    'name': 'Sydney',
    'full_name': 'Asia Pacific (Sydney)',
    'code': 'ap-southeast-2',
    'public': true,
    'zones': [
      'ap-southeast-2a',
      'ap-southeast-2b',
      'ap-southeast-2c'
    ]
  },
  {
    'name': 'Jakarta',
    'full_name': 'Asia Pacific (Jakarta)',
    'code': 'ap-southeast-3',
    'public': true,
    'zones': [
      'ap-southeast-3a',
      'ap-southeast-3b',
      'ap-southeast-3c'
    ]
  },
  {
    'name': 'Hong Kong',
    'full_name': 'Asia Pacific (Hong Kong)',
    'code': 'ap-east-1',
    'public': true,
    'zones': [
      'ap-east-1a',
      'ap-east-1b',
      'ap-east-1c'
    ]
  },
  {
    'name': 'Mumbai',
    'full_name': 'Asia Pacific (Mumbai)',
    'code': 'ap-south-1',
    'public': true,
    'zones': [
      'ap-south-1a',
      'ap-south-1b',
      'ap-south-1c'
    ]
  },
  {
    'name': 'São Paulo',
    'full_name': 'South America (São Paulo)',
    'code': 'sa-east-1',
    'public': true,
    'zone_limit': 2,
    'zones': [
      'sa-east-1a',
      'sa-east-1b',
      'sa-east-1c'
    ]
  },
  {
    'name': 'Bahrain',
    'full_name': 'Middle East (Bahrain)',
    'code': 'me-south-1',
    'public': true,
    'zones': [
      'me-south-1a',
      'me-south-1b',
      'me-south-1c'
    ]
  },
  {
    'name': 'Beijing',
    'full_name': 'China (Beijing)',
    'code': 'cn-north-1',
    'public': false,
    'zones': [
      'cn-north-1a',
      'cn-north-1b',
      'cn-north-1c'
    ]
  },
  {
    'name': 'Ningxia',
    'full_name': 'China (Ningxia)',
    'code': 'cn-northwest-1',
    'public': false,
    'zones': [
      'cn-northwest-1a',
      'cn-northwest-1b',
      'cn-northwest-1c'
    ]
  }
]

function getAWSRegionList() {
  return regionList.filter(r => r.public).map(r => r.code)
}

async function loadConfig(path  = './udexp.yaml') {
  const configFile = resolve(path)
  try {
    await access(configFile, constants.F_OK)
    const configRaw = await readFile(configFile)
    return safeLoad(configRaw, {})
  } catch {
    return null
  }
}

async function loadDefaultConfig() {
  return loadConfig('./config/udexp-defaults.yaml')
}

async function saveConfig(config, path  = './udexp.yaml') {
  const configFile = resolve(path)
  const data = safeDump(config, {})
  await writeFile(configFile, data)
}

function getDefaultSchedule() {
  return cron.replace('MINUTES', Math.floor(Math.random() * 60).toString())
}

async function createClickupWebhook(orgId, apiKey, url) {
  const resp = await fetch(
    `https://api.clickup.com/api/v2/team/${orgId}/webhook`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey
      },
      body: JSON.stringify({
        endpoint: url,
        events: [
          'taskCreated',
          'taskUpdated',
          'taskDeleted',
          'taskPriorityUpdated',
          'taskStatusUpdated',
          'taskAssigneeUpdated',
          'taskDueDateUpdated',
          'taskTagUpdated',
          'taskMoved',
          'taskCommentPosted',
          'taskCommentUpdated',
          'taskTimeEstimateUpdated',
          'taskTimeTrackedUpdated',
        ],
      })
    }
  )
  const data = await resp.json()
  return data.webhook
}

async function fetch (url, init) {
  const { default: nodeFetch } = await import('node-fetch')
  return await nodeFetch(url, init)
}

async function setupClickupWebhook(orgId, apiKey, url) {
  const resp = await fetch(
    `https://api.clickup.com/api/v2/team/${orgId}/webhook`,
    {
      method: 'GET',
      headers: {
        Authorization: apiKey
      }
    }
  )
  if (!resp.ok) {
    const message = await resp.text()
    throw new Error(`Clickup API error: ${message}`)
  }
  const { webhooks } = await resp.json()
  let hook = webhooks.find(hook => hook.endpoint === url)
  if (!hook) {
    hook = await createClickupWebhook(orgId, apiKey, url)
  }
  return hook
}

module.exports = {
  getUdexpSecret,
  getAWSRegionList,
  loadConfig,
  loadDefaultConfig,
  saveConfig,
  getDefaultSchedule,
  createUdexpSecret,
  updateUdexpSecret,
  setupClickupWebhook,
}
