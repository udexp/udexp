import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager"

const client = new SecretsManagerClient({ region: process.env.AWS_REGION })

const secret = {}

export async function getSecret(secretId) {
  if (!secret[secretId]) {
    const command = new GetSecretValueCommand({ SecretId: secretId })
    const response = await client.send(command)
    if (response.SecretString) {
      secret[secretId] = response.SecretString
    } else {
      secret[secretId] = Buffer.from(response.SecretBinary)
    }
  }
  return secret[secretId]
}
