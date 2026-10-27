# Runbook — Tenant migration & self-contained deployment

P-6 makes the stack portable: a Zambia-hosted (or any-region) replica is a
`git clone` + `docker compose up` away. This runbook covers standing up a
fresh host and migrating tenant data.

## Self-contained deployment

`docker-compose.prod.yml` bundles every dependency. The production host uses
`shared-postgres` and `pom-minio` via env vars; a fresh host needs nothing
external:

```bash
git clone <repo> && cd nkuku-companion-app
cp .env.example .env
# .env: DATABASE_URL=postgresql://nkuku_user:<pw>@postgres:5432/nkuku_db
#       REDIS_URL=redis://redis:6379
#       S3_ENDPOINT=http://minio:9000
docker compose -f docker-compose.prod.yml --profile self-contained up --build -d
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma db seed   # breeds, diseases, schedules, plans
```

The API creates the `nkuku-documents` bucket at boot (`ensureBucket`).

> **MinIO image availability (Sept 2026):** MinIO removed `minio/minio` from
> Docker Hub and Quay now requires auth. The bundled `minio` service uses
> `pgsty/silo` (maintained fork, same S3 API/env/on-disk format), digest-pinned.
> Prod's shared `pom-minio` still runs the cached `minio/minio:RELEASE.2024-11-07`
> image — **it cannot be re-pulled**. If that host ever loses the image, point
> the container at the same `pgsty/silo` tag on the existing data volume.

## Tenant export (per-organization, owner-initiated)

`GET /api/v1/organizations/export` (owner-only) returns a gzip'd JSON of all
org-scoped tables: flocks + all flock records, sales, journal + lines,
ledger balances, suppliers, batches, documents metadata, subscriptions,
members and member user identities (no password hashes).

Also available in the web UI: **Settings → Data & Privacy → Download export**.

## Tenant deletion (right to erasure)

`POST /api/v1/organizations/delete` (owner-only, requires typing the org
name) sets `deletedAt` + `purgeAfter = now + 30d` and deactivates the org —
all member tokens are rejected immediately (`ORGANIZATION_INACTIVE`).

A daily cron (`01:30`) hard-deletes orgs past `purgeAfter`:

- S3 document objects removed from `nkuku-documents`
- Journal immutability rules are temporarily disabled, rows deleted, rules
  re-enabled (requires the DB user to own the journal tables)
- Flock children cascade; all org-scoped tables deleted in FK-safe order
- Member users with no other memberships are deactivated

To restore during the grace window (before purge runs):

```sql
UPDATE organizations
SET deleted_at = NULL, purge_after = NULL, is_active = true
WHERE id = '<org-id>';
```

## Migrating the whole instance

1. `infra/scripts/backup.sh` on the old host (DB dump + MinIO mirror).
2. Restore DB into the new host's postgres (`restore-drill.sh` pattern).
3. Copy the `nkuku-documents` bucket contents to the new MinIO.
4. Point DNS at the new host; run compose self-contained as above.
5. Update `APP_API_BASE_URL` for new mobile builds if the domain changes.
