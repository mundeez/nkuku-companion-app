import { S3Client } from '@aws-sdk/client-s3';

let client: S3Client | null = null;

/**
 * Singleton S3Client configured from environment variables.
 * Targets the shared MinIO instance (pom-minio) on the shared-net network.
 */
export function getS3Client(): S3Client {
  if (client) return client;

  const endpoint = process.env.S3_ENDPOINT || 'http://pom-minio:9000';
  const region = process.env.S3_REGION || 'us-east-1';
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== 'false';

  client = new S3Client({
    endpoint,
    region,
    forcePathStyle,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || '',
      secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
  });

  return client;
}

export function getS3Bucket(): string {
  return process.env.S3_BUCKET || 'nkuku-documents';
}
