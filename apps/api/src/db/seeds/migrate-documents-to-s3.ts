/**
 * Backfill existing local-filesystem documents to MinIO/S3.
 *
 * Idempotent: skips documents that already have a storageKey.
 * Best-effort: if a local file is missing (e.g. lost to a container rebuild),
 * it logs a warning and marks the document's extractionStatus as 'failed'
 * but keeps the row for audit purposes.
 *
 * Usage:
 *   docker compose exec api npx tsx src/db/seeds/migrate-documents-to-s3.ts
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { putObject, buildStorageKey, ensureBucket } from '../../core/storage/storage.service.js';

const prisma = new PrismaClient();
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

async function main() {
  console.log('==> Ensuring S3 bucket exists...');
  await ensureBucket();

  console.log('==> Fetching documents with local filePath (no storageKey)...');
  const docs = await prisma.document.findMany({
    where: {
      storageKey: null,
      filePath: { not: null },
    },
  });

  console.log(`    Found ${docs.length} documents to migrate.`);

  let migrated = 0;
  let missing = 0;
  let failed = 0;

  for (const doc of docs) {
    const fullPath = path.resolve(UPLOAD_DIR, doc.filePath!);

    if (!fs.existsSync(fullPath)) {
      console.log(`  [SKIP] ${doc.id} — file not found at ${doc.filePath}`);
      try {
        await prisma.document.update({
          where: { id: doc.id },
          data: { extractionStatus: 'failed' },
        });
      } catch { /* ignore */ }
      missing++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(fullPath);
      const recordId = doc.recordId || doc.flockId || doc.id;
      const uuid = path.basename(doc.filePath!).split('-')[0] || crypto.randomUUID();
      const sanitized = path.basename(fullPath).replace(/[^a-zA-Z0-9._-]/g, '_');
      const storageKey = buildStorageKey(doc.recordType, recordId, uuid, sanitized);

      await putObject(storageKey, buffer, doc.mimeType);

      await prisma.document.update({
        where: { id: doc.id },
        data: {
          storageKey,
          bucket: process.env.S3_BUCKET || 'nkuku-documents',
        },
      });

      console.log(`  [OK]   ${doc.id} → ${storageKey}`);
      migrated++;
    } catch (err: any) {
      console.error(`  [FAIL] ${doc.id} — ${err.message}`);
      failed++;
    }
  }

  console.log('');
  console.log('==> Migration complete.');
  console.log(`    Migrated: ${migrated}`);
  console.log(`    Missing (file not found): ${missing}`);
  console.log(`    Failed: ${failed}`);
  console.log(`    Total processed: ${docs.length}`);
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
