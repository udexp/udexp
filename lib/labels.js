import fs from 'fs'
import { safeLoad } from 'js-yaml'
import labelSync from 'github-label-sync'

export async function syncLabels(repo, labels, token) {
  await labelSync({
    accessToken: token,
    allowAddedLabels: true,
    labels,
    repo,
  })
}

export async function syncLabelsFromFile(repo, file, token) {
  const labels = safeLoad(fs.readFileSync(file, 'utf8'), {})
  return syncLabels(repo, labels, token)
}
