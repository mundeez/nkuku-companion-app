#!/bin/sh
set -e

echo "[MIGRATE] Running Prisma migrations..."
docker compose exec api npx prisma migrate dev --name auto

echo "[MIGRATE] Seeding database..."
docker compose exec api npx prisma db seed

echo "[MIGRATE] Done!"

