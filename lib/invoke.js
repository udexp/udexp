import { LambdaClient, InvokeCommand, InvocationType } from '@aws-sdk/client-lambda'

const client = new LambdaClient({ region: process.env.AWS_REGION })

const PREFIX = process.env.NAME_PREFIX

export async function invoke (func_or_name, event, async = true) {
  const command = new InvokeCommand({
    FunctionName: getName(func_or_name),
    InvocationType: async ? InvocationType.Event : InvocationType.RequestResponse,
    Payload: Buffer.from(JSON.stringify(event)),
  })
  return client.send(command)
}

export class Invoker {
  constructor () {
    this._queue = []
  }

  start (name, event, async = true) {
    this._queue.push(invoke(name, event, async))
  }

  async flush () {
    const res = await Promise.allSettled(this._queue)
    this._queue = []
    return res
  }
}

function getName (func_or_name) {
  let name = func_or_name
  if (typeof func_or_name == 'function') {
    name = func_or_name.name
  }
  return `${PREFIX}${name}`
}
