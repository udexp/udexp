import { Octokit } from '@octokit/rest'
import { graphql } from '@octokit/graphql'
import { getSecret } from './secret'

let _octokit
let _octokitGraphql
const secretArn = process.env.GITHUB_TOKEN_SECRET

export async function getOctokit () {
  if (!_octokit) {
    _octokit = new Octokit({
      auth: await getSecret(secretArn),
    })
  }
  return _octokit
}

export async function getOctokitGraphql () {
  if (!_octokitGraphql) {
    _octokitGraphql = graphql.defaults({
      headers: {
        authorization: `token ${await getSecret(secretArn)}`,
      },
    })
  }
  return _octokitGraphql
}
