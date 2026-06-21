import AWS from 'aws-sdk';

const secretsManager = new AWS.SecretsManager({
  region: process.env.AWS_REGION || 'us-east-1',
});

export async function getSecrets(): Promise<Record<string, string>> {
  const secretName = process.env.AWS_SECRET_NAME || 'procurement/prod/app-config';
  const secret = await secretsManager
    .getSecretValue({
      SecretId: secretName,
    })
    .promise();

  if (!secret.SecretString) {
    throw new Error('SecretString is empty');
  }

  return JSON.parse(secret.SecretString);
}
