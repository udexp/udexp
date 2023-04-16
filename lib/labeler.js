export class Labeler {
    constructor(octokit, { owner, repo, issue_number }) {
        this.octokit = octokit
        this.owner = owner
        this.repo = repo
        this.issue_number = issue_number
        this.labelCache = null
    }

    async populateLabelCache() {
        const { data: labels } = await this.octokit.rest.issues.listLabelsForRepo({
            owner: this.owner,
            repo: this.repo,
        })
        this.labelCache = labels.map(l => l.name)
    }

    getMatchingLabels(labels) {
        if (!Array.isArray(labels)) {
            labels = [labels]
        }
        return labels.map(label => this.labelCache.filter(l => l.includes(label))[0])
    }

    async addLabels(labels) {
        if (!this.labelCache) {
            await this.populateLabelCache()
        }
        const matchingLabels = this.getMatchingLabels(labels)
        await this.octokit.rest.issues.addLabels({
            owner: this.owner,
            repo: this.repo,
            issue_number: this.issue_number,
            labels: [...new Set(matchingLabels)],
        })
    }

    async removeLabels(labels) {
        if (!this.labelCache) {
            await this.populateLabelCache()
        }
        const matchingLabels = this.getMatchingLabels(labels)
        await Promise.all(matchingLabels.map(async (l) => {
            try {
                await this.octokit.rest.issues.removeLabel({
                    owner: this.owner,
                    repo: this.repo,
                    issue_number: this.issue_number,
                    name: l,
                })
            } catch (e) {
                // ignore non existing label removal
                if (e.status !== 404) {
                    throw e
                }
            }
        }))
    }
}

export function hasReadyForReviewLabel(labels) {
    if (!Array.isArray(labels)) {
        labels = [labels]
    }
    return labels.filter(l => isReadyForReviewLabel(l)).length > 0
}

function isReadyForReviewLabel(label) {
    return label.toLowerCase().includes('ready for review')
}
