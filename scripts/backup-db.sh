#!/usr/bin/env bash
# Nightly PostgreSQL backup for the printer-service-system stack.
# Usage: ./scripts/backup-db.sh
# Expects to be run from the project root (where docker-compose.yml and .env live).
set -euo pipefail

cd "$(dirname "$0")/.."

set -a
source .env
set +a

BACKUP_DIR="/backups/db"
DATE="$(date +%F)"
DEST="$BACKUP_DIR/db_${DATE}.sql.gz"
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$DEST"

echo "Backup written to $DEST"

# Remove backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name 'db_*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete
