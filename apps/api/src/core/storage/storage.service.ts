import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getS3Client, getS3Bucket } from './s3-client.js';

let bucketEnsured = false;

/**
 * Ensure the configured bucket exists. Called once on API boot.
 * Idempotent — safe to call repeatedly.
 */
export async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return;
  const s3 = getS3Client();
  const bucket = getS3Bucket();

  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (err: any) {
    // Bucket doesn't exist (404) or NoSuchBucket
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchBucket') {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    } else {
      // Re-throw unexpected errors (auth, network, etc.)
      throw err;
    }
  }
  bucketEnsured = true;
}

/**
 * Upload a file to S3/MinIO.
 * @param key  Object key (e.g. "FinancialRecord/<uuid>/<file>.pdf")
 * @param body  Buffer or stream
 * @param contentType  MIME type
 */
export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const s3 = getS3Client();
  const bucket = getS3Bucket();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/**
 * Download an object from S3/MinIO as a Buffer.
 */
export async function getObject(key: string): Promise<Buffer> {
  const s3 = getS3Client();
  const bucket = getS3Bucket();

  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks: Uint8Array[] = [];
  // @ts-ignore — Body is a Readable stream
  for await (const chunk of response.Body) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Delete an object from S3/MinIO. Silently succeeds if the object is already gone.
 */
export async function deleteObject(key: string): Promise<void> {
  const s3 = getS3Client();
  const bucket = getS3Bucket();

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch {
    // Object may already be deleted — ignore
  }
}

/**
 * Build a storage key for a document attachment.
 * Format: <recordType>/<recordId>/<uuid>-<sanitizedFilename>
 */
export function buildStorageKey(
  recordType: string,
  recordId: string,
  uuid: string,
  sanitizedFilename: string,
): string {
  return `${recordType}/${recordId}/${uuid}-${sanitizedFilename}`;
}
