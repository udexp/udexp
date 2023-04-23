const prompts = require('prompts')
const { safeDump } = require('js-yaml')
const uuid = require('uuid')

const { launch, runSls } = require('./aws_launcher')
const {
  getAWSRegionList, loadConfig, loadDefaultConfig, getDefaultSchedule, saveConfig, getUdexpSecret,
  updateUdexpSecret, setupClickupWebhook, getGithubOrg, setupGithubWebhook,
} = require('./utils')

async function main() {
  const regions = getAWSRegionList()
  let configExists = true
  let config = await loadConfig()
  if (!config) {
    configExists = false
    config = await loadDefaultConfig()
  }
  if (!config) {
    throw new Error('Cannot load any config')
  }
  const region = config.region || process.env.AWS_REGION || 'us-east-1'
  const initialRegion = regions.indexOf(region) || regions.indexOf('us-east-1')
  let cancelled = false
  const onCancel = prompt => {
    cancelled = true
    return false
  }
  console.log('\nGlobals\n-------')
  const response = await prompts([
    {
      type: 'select',
      name: 'region',
      message: 'What is the desired AWS region?',
      initial: initialRegion,
      choices: regions.map(r => ({ title: r, value: r })),
    },
  ], { onCancel })
  if (cancelled) {
    return
  }
  if (config.secret) {
    response.secret = config.secret
  }
  const reviewFlows = [
    { title: 'Draft', value: 'draft', description: 'Use the new "Create Draft/Ready for Review" feature' },
    { title: 'Label', value: 'label', description: 'Use the "WIP"/"ready for review" labels' },
  ]
  console.log('\nGitHub\n------')
  response.github = await prompts([
    {
      type: 'select',
      name: 'reviewFlow',
      message: 'GitHub review flow type?',
      choices: reviewFlows,
      initial: reviewFlows.findIndex(r => r.value === config.github.reviewFlow),
    },
  ], { onCancel })
  if (cancelled) {
    return
  }
  if (config.github.route) {
    response.github.route = config.github.route
  }
  console.log('\nSlack\n-----')
  response.slack = await prompts([
    {
      type: 'text',
      name: 'reviewChannel',
      message: 'Slack channel for GitHub review requests?',
      initial: config.slack.reviewChannel,
    },
  ], { onCancel })
  if (cancelled) {
    return
  }
  if (config.slack.route) {
    response.slack.route = config.slack.route
  }
  console.log('\nClickUp™\n-------')
  response.clickup = await prompts([
    {
      type: 'confirm',
      name: 'enabled',
      message: 'Enable ClickUp™ integration?',
      initial: config.clickup.enabled,
    },
    {
      type: prev => prev ? 'text' : null,
      name: 'orgId',
      message: 'ClickUp™ organization ID?',
      initial: config.clickup.orgId,
      validate: value => {
        if (!value) {
          return 'Organization ID cannot be empty'
        }
        if (!/^[0-9]+$/.test(value)) {
          return 'Organization ID has to be numeric'
        }
        return true
      },
    },
  ], { onCancel })
  if (cancelled) {
    return
  }
  if (config.clickup.route) {
    response.clickup.route = config.clickup.route
  }
  console.log('\nStale PR\n--------')
  response.stalePR = await prompts([
    {
      type: 'confirm',
      name: 'enabled',
      message: 'Enable stale PR notifications?',
      initial: config.stalePR.enabled,
    },
    {
      type: prev => prev ? 'text' : null,
      name: 'start',
      message: 'Start checking after PR was opened for?',
      initial: config.stalePR.start,
    },
    {
      type: prev => prev ? 'text' : null,
      name: 'history',
      message: 'Search PR history for?',
      initial: config.stalePR.history,
    },
    {
      type: prev => prev ? 'text' : null,
      name: 'schedule',
      message: 'Send Slack notification at what schedule?',
      initial: config.stalePR.schedule || getDefaultSchedule(),
    },
  ], { onCancel })
  if (cancelled) {
    return
  }
  console.log('\nRepo Sync\n---------')
  const labelSync = await prompts([
    {
      type: 'confirm',
      name: 'enabled',
      message: 'Enable organization-wide label sync?',
      initial: true,
    },
  ], { onCancel })
  if (cancelled) {
    return
  }
  if (labelSync.enabled && config.repoSync) {
    response.repoSync = config.repoSync
  }
  let save = false
  if (configExists) {
    console.log('\n')
    const write = await prompts([
      {
        type: 'confirm',
        name: 'enabled',
        message: 'Overwrite existing udexp.yaml config?',
        initial: true,
      },
    ], { onCancel })
    if (cancelled) {
      return
    }
    save = write.enabled
  } else {
    save = true
  }
  if (save) {
    await saveConfig(response)
  }
  console.log('\nChecking the deployment state...')
  const [rc, out, err] = await runSls(['info', '--verbose'])
  if (rc !== 0) {
    if (/Stack with id .* does not exist/.test(out)) {
      console.log('Udexp is not deployed yet, you can run `sls deploy` now')
    } else {
      console.log(`Could not get sls status: ${out}\n${err}`)
    }
  } else {
    response.hooks = findHookURLs(out)
    await setupSlackManifest(response)
    await setupSecrets(response)
  }
}

function findHookURLs(data) {
  const urls = {}
  const matches = data.match(/(Github|Slack|Clickup)WebhookURL: [^\n]+/g)
  if (matches) {
    matches.forEach(line => {
      const m = line.match(/^(Github|Slack|Clickup)[^:]+:\s(.*)/)
      urls[m[1]] = m[2]
    })
  }
  return urls
}

async function setupSlackManifest(config) {
  if (config?.hooks?.Slack) {
    const manifest = await loadConfig('./slack-manifest.yaml')
    if (!manifest) {
      const defaults = await loadConfig('./config/slack-app-manifest.yaml')
      defaults.settings.interactivity.request_url = config.hooks.Slack
      await saveConfig(defaults, './slack-manifest.yaml')
    }
  }
}

async function setupSecrets(config) {
  const response = await getUdexpSecret(config.region)
  const secret = JSON.parse(response.SecretString)
  console.log('\nSecrets\n-------')
  const setup = await prompts([
    {
      type: 'confirm',
      name: 'do',
      message: 'Setup secrets now?',
      initial: !secret?.github?.token,
    }
  ])
  let cancelled = false
  const onCancel = prompt => {
    cancelled = true
    return false
  }
  if (setup.do) {
    secret.github = await prompts([
      {
        type: 'text',
        name: 'token',
        message: 'GtiHub personal token?',
        initial: secret.github.token,
      },
      {
        type: 'confirm',
        name: 'auto',
        message: 'Setup GtiHub webhook automatically?',
        initial: true,
      },
      {
        type: prev => prev ? null : 'text',
        name: 'webhookSecret',
        message: 'GtiHub webhook secret?',
        initial: secret.github.webhookSecret || uuid.v4(),
      },
    ], { onCancel })
    if (cancelled) {
      return
    }
    if (secret.github.auto) {
      if (!secret.github.webhookSecret) {
        secret.github.webhookSecret = uuid.v4()
      }
      if (!config?.hooks?.Github) {
        throw new Error('Could not find GitHub webhook deployment')
      }
      const resp = await prompts([
        {
          type: 'text',
          name: 'adminToken',
          message: 'GitHub organization `admin:org_hook` token (will not be saved)?',
        },
        {
          type: 'text',
          name: 'org',
          message: 'Github organization to set webhook on?',
          validate: async (value) => {
            if (!value) {
              return 'Organization name cannot be empty'
            }
            try {
              const org = await getGithubOrg(value, secret.github.token)
              if (!org) {
                return `Organization not found, or no permissions: ${value}`
              }
            } catch (e) {
              return e?.response?.data?.message || `${e}`
            }
            return true
          },
        },
      ])
      const hook = await setupGithubWebhook(resp.org, resp.adminToken, secret.github.webhookSecret, config.hooks.Github)
      if (!hook) {
        throw new Error('Github webhook creation failed, no permissions?')
      }
      console.log(`Created GitHub hook for: ${hook.config.url}`)
    }
    delete secret.github.auto
    secret.slack = await prompts([
      {
        type: 'text',
        name: 'token',
        message: 'Slack app token?',
        initial: secret.slack.token,
      },
      {
        type: 'text',
        name: 'signingSecret',
        message: 'Slack interaction signing secret?',
        initial: secret.slack.signingSecret,
      },
    ], { onCancel })
    if (cancelled) {
      return
    }
    if (config.clickup.enabled) {
      secret.clickup = await prompts([
        {
          type: 'text',
          name: 'apiKey',
          message: 'ClickUp™ API key?',
          initial: secret.clickup.apiKey,
        },
        {
          type: 'confirm',
          name: 'auto',
          message: 'Setup ClickUp™ webhook automatically?',
          initial: true,
        },
        {
          type: prev => prev ? null: 'text',
          name: 'webhookSecret',
          message: 'ClickUp™ webhook secret?',
          initial: secret.clickup.webhookSecret,
        },
      ], { onCancel })
      if (cancelled) {
        return
      }
      if (secret.clickup.auto) {
        const orgId = config?.clickup?.orgId
        if (!orgId) {
          throw new Error('Could not find ClickUp™ organization id in config')
        }
        if (!config?.hooks?.Clickup) {
          throw new Error('Could not find ClickUp™ webhook deployment')
        }
        const hook = await setupClickupWebhook(orgId, secret.clickup.apiKey, config.hooks.Clickup)
        secret.clickup.webhookSecret = hook.secret
      }
    }
    delete secret.clickup.auto
    console.log('\nSecret contents\n---------------')
    console.log(safeDump(secret, {}))
    const write = await prompts([
      {
        type: 'confirm',
        name: 'enabled',
        message: 'Use this secret?',
        initial: false,
      },
    ])
    if (write.enabled) {
      await updateUdexpSecret(config.region, secret)
    }
  }
}

launch(main)
