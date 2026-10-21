#!/usr/bin/env bash
# Restore drill: restores the latest Postgres backup into a scratch database
# on shared-postgres, verifies table counts, then drops it.
# Usage: infra/scripts/restore-drill.sh [path/to/nkuku_db.dump]
set -euo pipefail

BACKUP_ROOT="${NKUKU_BACKUP_DIR:-$HOME/.godaddy_devin/backups/daily}"
DUMP="${1:-$(ls -1d "$BACKUP_ROOT"/20*/nkuku_db.dump 2>/dev/null | sort | tail -1)}"
[ -f "$DUMP" ] || { echo "no dump found (looked in $BACKUP_ROOT)"; exit 1; }
echo "restoring $DUMP"

DB="nkuku_restore_$(date +%s)"
docker exec shared-postgres psql -U postgres -d postgres -c "CREATE DATABASE $DB OWNER nkuku_user"
trap 'docker exec shared-postgres psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS $DB" >/dev/null 2>&1 || true' EXIT

docker cp "$DUMP" shared-postgres:/tmp/restore-drill.dump
# Run as postgres superuser: the dump includes timescaledb extension objects
# (shared-postgres has it installed) that nkuku_user cannot create/comment.
# --no-owner keeps object ownership sane; --no-comments skips extension COMMENTs.
docker exec shared-postgres pg_restore -U postgres -d "$DB" \
  --disable-triggers --no-owner --no-comments --exit-on-error /tmp/restore-drill.dump
docker exec shared-postgres rm /tmp/restore-drill.dump

COUNTS=$(docker exec shared-postgres psql -U postgres -d "$DB" -tAc "
  SELECT 'flocks=' || count(*) FROM broiler_flocks
  UNION ALL SELECT 'orgs=' || count(*) FROM organizations
  UNION ALL SELECT 'users=' || count(*) FROM users
  UNION ALL SELECT 'journal=' || count(*) FROM journal_entries")
echo "$COUNTS"
echo "$COUNTS" | grep -q "orgs=[1-9]" || { echo "FAIL: no organizations restored"; exit 1; }
echo "restore drill PASSED (scratch DB $DB dropped)"
