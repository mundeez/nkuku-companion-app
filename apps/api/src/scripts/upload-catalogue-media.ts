/**
 * Upload curated disease-catalogue images to S3 and emit the public
 * media URLs + attribution records to update the diseases table.
 *
 * Usage (inside api container or via tsx with env loaded):
 *   pnpm tsx src/scripts/upload-catalogue-media.ts <manifest.json> [--apply]
 *
 * Manifest: JSON array of
 *   { "disease": "<exact disease name>", "imageUrl": "<direct https image>",
 *     "filePage": "<source page>", "license": "...", "attribution": "..." }
 *
 * Without --apply it only downloads + validates images and prints the plan.
 * With --apply it uploads to S3 (catalogue/diseases/<slug>.<ext>) and updates
 * each disease's imageUrl + appends attribution to sources-adjacent media
 * metadata printed as JSON for review (DB update is a separate reviewed step).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { putObject } from '../core/storage/storage.service.js';
import { PrismaClient } from '@prisma/client';

const MEDIA_BASE = process.env.MEDIA_PUBLIC_BASE || 'https://nkuku.deeztechnology.solutions/api/v1/media';
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

interface ManifestItem {
  disease: string;
  imageUrl: string | null;
  filePage?: string;
  license?: string;
  attribution?: string | null;
  reason?: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function main() {
  const manifestPath = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!manifestPath) {
    console.error('usage: upload-catalogue-media.ts <manifest.json> [--apply]');
    process.exit(1);
  }
  const items: ManifestItem[] = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const prisma = new PrismaClient();
  const results: any[] = [];

  for (const item of items) {
    if (!item.imageUrl) {
      results.push({ disease: item.disease, status: 'skipped', reason: item.reason ?? 'no image' });
      continue;
    }
    const disease = await prisma.disease.findFirst({ where: { name: item.disease } });
    if (!disease) {
      results.push({ disease: item.disease, status: 'error', reason: 'disease not found' });
      continue;
    }
    // Download — Wikimedia rate-limits bursts; be polite and retry 429s.
    let res: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      res = await fetch(item.imageUrl, {
        headers: { 'User-Agent': 'NkukuCompanion/1.59 (+https://nkuku.deeztechnology.solutions)' },
        redirect: 'follow',
      });
      if (res.status !== 429) break;
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
    }
    await new Promise((r) => setTimeout(r, 1200));
    const resp = res as Response;
    if (!resp.ok) {
      results.push({ disease: item.disease, status: 'error', reason: `download HTTP ${resp.status}` });
      continue;
    }
    const mime = (resp.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const ext = EXT_BY_MIME[mime];
    if (!ext) {
      results.push({ disease: item.disease, status: 'error', reason: `unsupported content-type ${mime}` });
      continue;
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) {
      results.push({ disease: item.disease, status: 'error', reason: 'image >8MB' });
      continue;
    }
    const file = `${slugify(item.disease)}.${ext}`;
    const key = `catalogue/diseases/${file}`;
    const publicUrl = `${MEDIA_BASE}/catalogue/diseases/${file}`;

    if (apply) {
      await putObject(key, buf, mime);
      await prisma.disease.update({
        where: { id: disease.id },
        data: { imageUrl: publicUrl },
      });
    }
    results.push({
      disease: item.disease,
      status: apply ? 'uploaded' : 'planned',
      file,
      key,
      publicUrl,
      bytes: buf.length,
      mime,
      license: item.license ?? null,
      attribution: item.attribution ?? null,
      filePage: item.filePage ?? null,
    });
  }

  writeFileSync(manifestPath.replace(/\.json$/, '') + '.results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.map((r) => ({ disease: r.disease, status: r.status, reason: r.reason })), null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
