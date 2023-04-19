const { spawn } = require('child_process')
const { getSignalByName } = require('./signals')

function launch(func) {
  if (process.env.AWS_SDK_LOAD_CONFIG !== '1') {
    const args = []
    args.push(...process.execArgv, ...process.argv.slice(1))
    const child = spawn(process.argv[0], args, { stdio: 'inherit', env: { ...process.env, AWS_SDK_LOAD_CONFIG: '1' } })
    process.on('SIGINT', () => {})
    child.on('exit', (code, signal) => {
      if (code != null) {
        process.exit(code)
      } else {
        const sigNumber = getSignalByName(signal)?.number || 0
        process.exit(128 + sigNumber)
      }
    })
  } else {
    func().then()
  }
}

async function runSls(args) {
  const sls = spawn('sls', args, { env: { ...process.env, AWS_SDK_LOAD_CONFIG: '1' } })
  return new Promise((resolve, reject) => {
    const output = []
    const err = []
    sls.on('error', (err) => {
      reject(err)
    })
    sls.stdout.on('data', (data) => {
      output.push(data)
    })
    sls.stderr.on('data', (data) => {
      err.push(data)
    })
    sls.on('exit', (code, signal) => {
      let rc
      if (code != null) {
        rc = code
      } else {
        const sigNumber = getSignalByName(signal)?.number || 0
        rc = 128 + sigNumber
      }
      resolve([rc, output.join(''), err.join('')])
    })
  })
}

module.exports = {
  launch,
  runSls,
}
