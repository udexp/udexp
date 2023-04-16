import fs from 'fs'

import parse from 'json-templates'

export class JsonTemplate {
  constructor (path) {
    this.template = parse(fs.readFileSync(path).toString())
  }

  render (data) {
    return JSON.parse(this.template(data))
  }
}
