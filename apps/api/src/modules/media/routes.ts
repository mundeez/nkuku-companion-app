import type { FastifyInstance } from 'fastify';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client, getS3Bucket } from '../../core/storage/s3-client.js';

// Public read-only proxy for catalogue media (disease images etc.).
// Objects live in the private documents bucket under catalogue/ — this
// endpoint streams them without auth so tenant-facing <img>/players work
// without making the bucket public. Keys are strictly whitelisted.

const FILE_RE = /^[a-z0-9][a-z0-9._-]{0,120}$/;
const PREFIX = 'catalogue/diseases/';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

export async function buildMediaModule(app: FastifyInstance) {
  app.get('/catalogue/diseases/:file', async (request, reply) => {
    const { file } = request.params as { file: string };
    if (!FILE_RE.test(file)) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid media key' });
    }
    const key = `${PREFIX}${file}`;
    try {
      const res = await getS3Client().send(
        new GetObjectCommand({ Bucket: getS3Bucket(), Key: key }),
      );
      const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
      reply.header('Content-Type', MIME[ext] ?? 'application/octet-stream');
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Content-Length', String(res.ContentLength ?? 0));
      return reply.send(res.Body);
    } catch {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }
  });
}
