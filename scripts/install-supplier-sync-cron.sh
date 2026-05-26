#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/var/www/caracaltech}"
SCHEDULE="${SCHEDULE:-20 2 * * *}"
SOURCES="${SOURCES:-automaxtools,mk3,obdii365,uobdii}"
LIMIT="${LIMIT:-25}"
DELAY_MS="${DELAY_MS:-1000}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
CRON_FILE="/etc/cron.d/caracal-supplier-sync"

cat > "$CRON_FILE" <<EOF
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

$SCHEDULE root cd "$APP_DIR" && docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm api pnpm --filter @caracal/api supplier:sync -- --mode=stage --sources="$SOURCES" --limit="$LIMIT" --delay-ms="$DELAY_MS" >> /var/log/caracal-supplier-sync.log 2>&1
EOF

chmod 0644 "$CRON_FILE"
echo "Installed $CRON_FILE"
