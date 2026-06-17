#!/usr/bin/env bash
# Restore a PostgreSQL backup created by backup-db.sh.
# Usage: ./scripts/restore-db.sh /backups/db/db_2026-06-10.sql.gz
# WARNING: this overwrites the current database contents.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ $# -ne 1 ]; then
  echo "Usage: $0 <path-to-backup.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

set -a
source .env
set +a

read -r -p "This will overwrite the '${POSTGRES_DB}' database. Continue? [y/N] " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Aborted."
  exit 1
fi

gunzip -c "$BACKUP_FILE" | docker compose exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB"

echo "Restore complete from $BACKUP_FILE"
