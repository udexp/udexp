const prompts = require('prompts')

const { launch, runSls} = require('./aws_launcher')
const { getAWSRegionList, loadConfig, loadDefaultConfig, getDefaultSchedule, saveConfig, setupSecrets } = require('./utils')

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
  const response = await prompts([
    {
      type: 'select',
      name: 'region',
      message: 'What is the desired AWS region?',
      initial: initialRegion,
      choices: regions.map(r => ({ title: r, value: r })),
    },
    {
      type: 'text',
      name: 'database',
      message: 'Database name?',
      initial: config.database,
    },
  ])
  if (config.secret) {
    response.secret = config.secret
  }
  const reviewFlows = [
    { title: 'Draft', value: 'draft', description: 'Use the new "Create Draft/Ready for Review" feature' },
    { title: 'Label', value: 'label', description: 'Use the "WIP"/"ready for review" labels' },
  ]
  response.github = await prompts([
    {
      type: 'select',
      name: 'reviewFlow',
      message: 'GitHub review flow type?',
      choices: reviewFlows,
      initial: reviewFlows.findIndex(r => r.value === config.github.reviewFlow),
    },
  ])
  if (config.github.route) {
    response.github.route = config.github.route
  }
  response.slack = await prompts([
    {
      type: 'text',
      name: 'reviewChannel',
      message: 'Slack channel for GitHub review requests?',
      initial: config.slack.reviewChannel,
    },
  ])
  if (config.slack.route) {
    response.slack.route = config.slack.route
  }
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
  ])
  if (config.clickup.route) {
    response.clickup.route = config.clickup.route
  }
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
  ])
  const labelSync = await prompts([
    {
      type: 'confirm',
      name: 'enabled',
      message: 'Enable organization-wide label sync?',
      initial: true,
    },
  ])
  if (labelSync.enabled && config.repoSync) {
    response.repoSync = config.repoSync
  }
  let save = false
  if (configExists) {
    const write = await prompts([
      {
        type: 'confirm',
        name: 'enabled',
        message: 'Overwrite existing udexp.yaml config?',
        initial: true,
      },
    ])
    save = write.enabled
  } else {
    save = true
  }
  if (save) {
    await saveConfig(response)
  }
  const [rc, out, err] = await runSls(['info'])
  if (rc !== 0) {
    if (/Stack with id .* does not exist/.test(out)) {
      console.log('Udexp is not deployed yet, you can run `sls deploy` now')
    } else {
      console.log(`Could not get sls status: ${out}\n${err}`)
    }
  } else {
    await setupSecrets()
  }
}

launch(main)
