#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

read_env_value() {
  key="$1"
  if [ ! -f "$ENV_FILE" ]; then
    return 1
  fi

  value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d '=' -f 2- || true)"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"

  if [ -n "$value" ]; then
    printf '%s' "$value"
    return 0
  fi

  return 1
}

POSTGRES_USER="${POSTGRES_USER:-$(read_env_value POSTGRES_USER || true)}"
POSTGRES_DB="${POSTGRES_DB:-$(read_env_value POSTGRES_DB || true)}"
POSTGRES_USER="${POSTGRES_USER:-caracal}"
POSTGRES_DB="${POSTGRES_DB:-caracal}"

case "$BACKUP_DIR" in
  /*) BACKUP_PATH="$BACKUP_DIR" ;;
  *) BACKUP_PATH="$(pwd)/$BACKUP_DIR" ;;
esac

mkdir -p "$BACKUP_PATH"

DB_DUMP="$BACKUP_PATH/postgres-$TIMESTAMP.sql"
UPLOADS_ARCHIVE="$BACKUP_PATH/api-uploads-$TIMESTAMP.tgz"
LOGS_ARCHIVE="$BACKUP_PATH/api-logs-$TIMESTAMP.tgz"
CONFIG_ARCHIVE="$BACKUP_PATH/config-$TIMESTAMP.tgz"

echo "Creating PostgreSQL backup: $DB_DUMP"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists > "$DB_DUMP"

echo "Creating upload volume backup: $UPLOADS_ARCHIVE"
docker run --rm \
  -v caracal-api-uploads:/data:ro \
  -v "$BACKUP_PATH:/backup" \
  alpine:3.20 tar -czf "/backup/$(basename "$UPLOADS_ARCHIVE")" -C /data .

echo "Creating API log volume backup: $LOGS_ARCHIVE"
docker run --rm \
  -v caracal-api-logs:/data:ro \
  -v "$BACKUP_PATH:/backup" \
  alpine:3.20 tar -czf "/backup/$(basename "$LOGS_ARCHIVE")" -C /data .

echo "Creating deployment config backup: $CONFIG_ARCHIVE"
tar -czf "$CONFIG_ARCHIVE" \
  --ignore-failed-read \
  .env.production \
  docker-compose.yml \
  docker-compose.prod.yml \
  docker/nginx/conf.d \
  docker/nginx/certs/README.md

echo "Backup complete:"
echo "- $DB_DUMP"
echo "- $UPLOADS_ARCHIVE"
echo "- $LOGS_ARCHIVE"
echo "- $CONFIG_ARCHIVE"
