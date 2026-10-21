#!/usr/bin/env bash
# Nkuku production backup — Postgres dump + MinIO bucket mirror.
# Intended to be run from cron on the prod host, e.g.:
#   30 3 * * * /home/mundeez/DevWorkz/nkuku-companion-app/infra/scripts/backup.sh >> ~/.godaddy_devin/backups/backup.log 2>&1
#
# Retention: 14 daily dumps + monthly snapshots kept on the 1st.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# Load only the vars we need from .env (full `source` breaks on values
# containing spaces/<> such as SMTP_FROM).
env_get() { grep -E "^$1=" "$REPO_ROOT/.env" 2>/dev/null | tail -1 | cut -d= -f2-; }
S3_ACCESS_KEY="$(env_get S3_ACCESS_KEY)"
S3_SECRET_KEY="$(env_get S3_SECRET_KEY)"

BACKUP_ROOT="${NKUKU_BACKUP_DIR:-$HOME/.godaddy_devin/backups/daily}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_ROOT/$STAMP"
mkdir -p "$DEST"

log() { echo "[$(date +%H:%M:%S)] $*"; }

# ── 1. Postgres (prod DB lives on shared-postgres, NOT the bundled container)
log "pg_dump nkuku_db from shared-postgres"
docker exec shared-postgres pg_dump -U nkuku_user -d nkuku_db \
  --format=custom --compress=6 -f "/tmp/nkuku-$STAMP.dump"
docker cp "shared-postgres:/tmp/nkuku-$STAMP.dump" "$DEST/nkuku_db.dump"
docker exec shared-postgres rm "/tmp/nkuku-$STAMP.dump"

# Verify the archive is readable and non-trivial
TABLES=$(docker cp "$DEST/nkuku_db.dump" shared-postgres:/tmp/chk.dump >/dev/null && \
  docker exec shared-postgres pg_restore --list /tmp/chk.dump | grep -c "TABLE DATA"; \
  docker exec shared-postgres rm /tmp/chk.dump)
[ "$TABLES" -ge 70 ] || { log "ERROR: dump only lists $TABLES tables"; exit 1; }
log "dump verified: $TABLES table-data entries"

# ── 2. MinIO bucket mirror (best-effort — don't fail the backup on S3 hiccups)
mkdir -p "$DEST/minio"
if docker run --rm --network shared-net -v "$DEST/minio:/out" \
    --entrypoint sh minio/mc:latest -c "
    mc alias set src http://pom-minio:9000 '$S3_ACCESS_KEY' '$S3_SECRET_KEY' --api s3v4 &&
    mc mirror --overwrite src/nkuku-documents /out" 2>/dev/null; then
  log "minio mirror done: $(du -sh "$DEST/minio" | cut -f1)"
else
  log "WARN: minio mirror failed (continuing)"
fi

# ── 3. Retention
cd "$BACKUP_ROOT"
# Delete daily backups older than 14 days, except ones from the 1st of the month
find . -maxdepth 1 -type d -name '20*' -mtime +14 \
  ! -name '??????01-*' -exec rm -rf {} +
# Delete monthly snapshots older than 12 months
find . -maxdepth 1 -type d -name '??????01-*' -mtime +365 -exec rm -rf {} +

log "backup complete: $DEST ($(du -sh "$DEST" | cut -f1))"
