import fs from 'fs'
import { safeLoad } from 'js-yaml'
import labelSync from 'github-label-sync'
import { getSecret } from './secret'

const secretArn = process.env.GITHUB_TOKEN_SECRET

export async function syncLabels(repo, labels) {
  await labelSync({
    accessToken: await getSecret(secretArn),
    allowAddedLabels: true,
    labels,
    repo,
  })
}

export async function syncLabelsFromFile(repo, file) {
  const labels = safeLoad(fs.readFileSync(file, 'utf8'), {})
  return syncLabels(repo, labels)
}
