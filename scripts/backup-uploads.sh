#!/usr/bin/env bash
# Nightly backup of the "uploads" Docker volume (job photos, signatures, company logos).
# Usage: ./scripts/backup-uploads.sh
# Expects to be run from the project root (where docker-compose.yml lives).
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT_NAME="$(basename "$(pwd)")"
VOLUME_NAME="${PROJECT_NAME}_uploads"

BACKUP_DIR="/backups/uploads"
DATE="$(date +%F)"
DEST="$BACKUP_DIR/uploads_${DATE}.tar.gz"
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

# Use a throwaway container to tar up the volume contents (avoids permission issues
# and works regardless of the host's docker data-root location).
docker run --rm \
  -v "${VOLUME_NAME}:/data:ro" \
  -v "${BACKUP_DIR}:/backup" \
  alpine \
  sh -c "tar -czf /backup/uploads_${DATE}.tar.gz -C /data ."

echo "Backup written to $DEST"

# Remove backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name 'uploads_*.tar.gz' -mtime "+${RETENTION_DAYS}" -delete
