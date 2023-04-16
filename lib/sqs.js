export const SqsExecute = async (event, func) => {
  return Promise.all(event.Records.map(async message => {
    const event = {}
    event.headers = parseAttributes(message.messageAttributes)
    if (event.headers['content-type'] === 'application/json') {
      event.body = JSON.parse(message.body)
    }
    const result = await func(event)
    if (!result?.statusCode || result?.statusCode >= 300) {
      console.log("bad result", JSON.stringify(result))
    }
  }))
}

const convert = (str) => str.replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? '-' : '') + $.toLowerCase())

function parseAttributes(attrs) {
  const headers = {}
  Object.keys(attrs).forEach(name => {
    // headers are always strings
    const value = attrs[name].stringValue
    const key = convert(name)
    headers[key] = value
  })
  return headers
}
