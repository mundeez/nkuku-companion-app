#!/usr/bin/env bash
# ============================================================
# Create a dedicated MinIO service account for the Nkuku
# Companion App, scoped to the nkuku-documents bucket only.
#
# Prerequisites:
#   - The shared pom-minio container must be running on the
#     shared-net Docker network.
#   - You need the MinIO root credentials (MINIO_ROOT_USER /
#     MINIO_ROOT_PASSWORD) for the pom-minio container.
#
# Usage:
#   MINIO_ROOT_USER=pom-minio-user \
#   MINIO_ROOT_PASSWORD='PomMinio@2026!' \
#   NKUKU_SECRET_KEY='<your-strong-secret-key>' \
#   bash infra/minio/setup-nkuku-account.sh
#
# This script is idempotent — safe to re-run.
# ============================================================
set -euo pipefail

MINIO_ROOT_USER="${MINIO_ROOT_USER:-pom-minio-user}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://pom-minio:9000}"

# Service account credentials for the Nkuku app.
# The secret key must be provided via the NKUKU_SECRET_KEY environment
# variable — never hardcode it in this file or commit it to version control.
NKUKU_ACCESS_KEY="${NKUKU_ACCESS_KEY:-nkuku-app}"
NKUKU_SECRET_KEY="${NKUKU_SECRET_KEY:?NKUKU_SECRET_KEY is required}"
BUCKET="${S3_BUCKET:-nkuku-documents}"

echo "==> Connecting to MinIO at ${MINIO_ENDPOINT} ..."
docker run --rm --network shared-net --entrypoint sh minio/mc:latest -c "
  set -e
  mc alias set pom ${MINIO_ENDPOINT} '${MINIO_ROOT_USER}' '${MINIO_ROOT_PASSWORD}'

  echo '==> Creating bucket: ${BUCKET}'
  mc mb pom/${BUCKET} 2>/dev/null || echo '   bucket already exists'

  echo '==> Creating readwrite policy scoped to ${BUCKET}'
  cat > /tmp/nkuku-rw.json <<'JSON'
{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
    {
      \"Effect\": \"Allow\",
      \"Action\": [\"s3:*\"],
      \"Resource\": [\"arn:aws:s3:::${BUCKET}\", \"arn:aws:s3:::${BUCKET}/*\"]
    }
  ]
}
JSON
  mc admin policy create pom ${BUCKET}-readwrite /tmp/nkuku-rw.json 2>/dev/null || \
    mc admin policy update pom ${BUCKET}-readwrite /tmp/nkuku-rw.json 2>/dev/null || \
    echo '   policy already exists'

  echo '==> Creating service account: ${NKUKU_ACCESS_KEY}'
  mc admin user add pom '${NKUKU_ACCESS_KEY}' '${NKUKU_SECRET_KEY}' 2>/dev/null || echo '   user already exists'
  mc admin policy attach pom ${BUCKET}-readwrite --user '${NKUKU_ACCESS_KEY}'

  echo '==> Verification'
  mc admin user info pom '${NKUKU_ACCESS_KEY}'
  mc ls pom/${BUCKET}
"

echo ""
echo "==> Done. Add these to your .env:"
echo "   S3_ACCESS_KEY=${NKUKU_ACCESS_KEY}"
echo "   S3_SECRET_KEY=${NKUKU_SECRET_KEY}"
echo "   S3_BUCKET=${BUCKET}"
