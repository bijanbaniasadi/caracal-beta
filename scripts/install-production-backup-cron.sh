#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/var/www/caracaltech}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
SCHEDULE="${SCHEDULE:-15 3 * * *}"
CRON_FILE="/etc/cron.d/caracal-production-backup"

cat > "$CRON_FILE" <<EOF
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

$SCHEDULE root cd "$APP_DIR" && BACKUP_DIR="$BACKUP_DIR" sh scripts/backup-production.sh >> /var/log/caracal-production-backup.log 2>&1
EOF

chmod 0644 "$CRON_FILE"
echo "Installed $CRON_FILE"
