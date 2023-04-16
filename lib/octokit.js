import { Octokit } from '@octokit/rest'
import { graphql } from '@octokit/graphql'

let _octokit
let _octokitGraphql

export function getOctokit (token) {
  if (!_octokit) {
    _octokit = new Octokit({
      auth: token,
    })
  }
  return _octokit
}

export function getOctokitGraphql (token) {
  if (!_octokitGraphql) {
    _octokitGraphql = graphql.defaults({
      headers: {
        authorization: `token ${token}`,
      },
    })
  }
  return _octokitGraphql
}
