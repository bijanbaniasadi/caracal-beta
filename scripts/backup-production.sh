#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
POSTGRES_USER="${POSTGRES_USER:-caracal}"
POSTGRES_DB="${POSTGRES_DB:-caracal}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"

DB_DUMP="$BACKUP_DIR/postgres-$TIMESTAMP.sql"
UPLOADS_ARCHIVE="$BACKUP_DIR/api-uploads-$TIMESTAMP.tgz"
LOGS_ARCHIVE="$BACKUP_DIR/api-logs-$TIMESTAMP.tgz"

echo "Creating PostgreSQL backup: $DB_DUMP"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists > "$DB_DUMP"

echo "Creating upload volume backup: $UPLOADS_ARCHIVE"
docker run --rm \
  -v caracal-api-uploads:/data:ro \
  -v "$(pwd)/$BACKUP_DIR:/backup" \
  alpine:3.20 tar -czf "/backup/$(basename "$UPLOADS_ARCHIVE")" -C /data .

echo "Creating API log volume backup: $LOGS_ARCHIVE"
docker run --rm \
  -v caracal-api-logs:/data:ro \
  -v "$(pwd)/$BACKUP_DIR:/backup" \
  alpine:3.20 tar -czf "/backup/$(basename "$LOGS_ARCHIVE")" -C /data .

echo "Backup complete:"
echo "- $DB_DUMP"
echo "- $UPLOADS_ARCHIVE"
echo "- $LOGS_ARCHIVE"
