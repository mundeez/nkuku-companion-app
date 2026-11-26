# Media Storage Options — Self-Hosting Plan (Future Development)

> **Status:** Planning document. Not yet implemented. The disease catalogue
> currently serves media via external URLs (royalty-free images, YouTube/Vimeo
> embeds). This doc evaluates self-hosting options for when link-rot, licensing,
> or offline/mobile-data costs justify owning the assets.

## Context

- `diseases.image_url` / `video_url` currently hold external `https` URLs.
- The platform already runs **MinIO** (S3-compatible) for document attachments
  behind the API (`S3_ENDPOINT`, per `docker-compose.prod.yml`).
- Candidate self-hosted object stores: **SeaweedFS**, **Garage**, **MinIO**.

## Requirements

| Requirement | Weight |
|---|---|
| S3-compatible API (reuse existing upload/service code) | High |
| Single-binary / simple ops on the existing VPS | High |
| Low RAM footprint (shared VPS with API/web/db) | High |
| Durability / erasure coding or replication | Medium |
| Cost (licensing) | Medium |

## Comparison

### MinIO (already deployed)

- **Pros:** Already in the stack for documents; mature S3 API; console UI;
  erasure coding; large ecosystem.
- **Cons:** Heaviest of the three (4–8 GB RAM recommended for production
  configs); AGPL license — fine for internal use, review if offering hosted
  storage as a service; historically moved some features (object lifecycle,
  tiering) to paid "AIStor" tiers — verify community-edition feature set
  before relying on them.
- **Fit:** Lowest integration cost — reuse the existing bucket/Credentials.
  Recommended **default** unless its resource footprint becomes a problem.

### SeaweedFS

- **Pros:** Very lightweight master+volume servers; built-in erasure coding
  (10.4 layout) and replication; handles billions of small files well (good
  for many catalogue thumbnails); single Go binary; Apache 2.0.
- **Cons:** More moving parts (master, volume, filer, S3 gateway); smaller
  community than MinIO; operational docs thinner.
- **Fit:** Best if we outgrow MinIO's footprint or need extreme file-count
  scale. Medium integration cost (new S3 endpoint config only — API is
  S3-compatible).

### Garage

- **Pros:** Lightest option (~100 MB RAM); designed for geo-distributed
  small clusters; S3-compatible; AGPL; single binary; good fit for a single
  small VPS.
- **Cons:** Younger project; fewer production references; admin/ops tooling
  minimal; no built-in console.
- **Fit:** Attractive for a resource-constrained VPS, but higher risk on
  maturity. Candidate if MinIO proves too heavy.

## Recommendation

1. **Near term:** reuse the existing MinIO deployment — add a dedicated
   `catalogue-media` bucket (private, served via signed URLs or a CDN in
   front). Zero new infrastructure.
2. **If MinIO footprint becomes a problem:** evaluate Garage next (lightest
   S3-compatible fit for this VPS size), then SeaweedFS if file-count scale
   demands it.
3. Avoid running two object stores — pick one per environment.

## Migration path (when approved)

1. Provision bucket + least-privilege credentials per environment.
2. Add `CATALOGUE_MEDIA_BUCKET` / endpoint env vars; extend the existing S3
   service (already used for documents) with a `catalogue-media` prefix.
3. Backfill: script downloads external `image_url`s (respecting license),
   uploads to bucket, rewrites DB URLs to the new CDN/bucket URL. Keep the
   external URL in `sources` attribution where licensing requires it.
4. Update clients: no change needed — `image_url`/`video_url` remain plain
   `https` URLs; only the host changes.
5. Licensing gate: only self-host assets with verified CC0/CC-BY/public-domain
   or owned licenses; keep attribution text in the disease record.

## Open questions

- CDN in front of the bucket? (Cloudflare free tier would absorb image
  bandwidth cheaply.)
- Do we self-host video too, or keep YouTube embeds (zero storage cost,
  better transcoding)? Leaning: images self-host, video stays embedded.
