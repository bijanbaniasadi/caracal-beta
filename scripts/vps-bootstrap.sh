#!/usr/bin/env bash
set -euo pipefail

LIVE_DIR="/var/www/caracaltech"
DEFAULT_BRANCH="production-vps-fixes"
REMOTE_URL="${1:-}"
BRANCH="${2:-$DEFAULT_BRANCH}"
TIMESTAMP="$(date -u +%Y%m%d%H%M%S)"
ROLLBACK_DIR="/var/www/caracaltech-preclone-${TIMESTAMP}"
ENV_BACKUP="/root/.env.production.vps-backup"
DB_DUMP="/root/caracal_db_preclone_${TIMESTAMP}.dump"

die() {
  echo "FAIL: $*" >&2
  exit 1
}

compose_in() {
  local dir="$1"
  shift
  docker compose -f "${dir}/docker-compose.prod.yml" --env-file "${dir}/.env.production" "$@"
}

read_env() {
  local key="$1"
  local file="$2"
  local line value

  line="$(grep -E "^[[:space:]]*${key}=" "$file" | tail -n 1 || true)"
  [[ -n "$line" ]] || die "Missing ${key} in ${file}"

  value="${line#*=}"
  value="${value%$'\r'}"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
  fi
  if [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  [[ -n "$value" ]] || die "${key} is empty in ${file}"
  printf '%s' "$value"
}

wait_for_user_count() {
  local dir="$1"
  local postgres_user="$2"
  local postgres_db="$3"
  local postgres_password="$4"
  local count

  for _ in $(seq 1 30); do
    if count="$(compose_in "$dir" exec -T -e PGPASSWORD="$postgres_password" postgres \
      psql -U "$postgres_user" -d "$postgres_db" -tAc 'SELECT COUNT(*) FROM "User";' 2>/dev/null)"; then
      echo "User row count: ${count//[[:space:]]/}"
      return 0
    fi
    sleep 2
  done

  echo "User row count: unavailable"
  return 1
}

wait_for_http_health() {
  local body

  for _ in $(seq 1 30); do
    if body="$(curl -fsS http://localhost/health/ready 2>/dev/null)"; then
      echo "Health body: $body"
      return 0
    fi
    sleep 2
  done

  echo "Health body: unavailable"
  return 1
}

[[ "${EUID}" -eq 0 ]] || die "Run this script on the VPS as root."
[[ -n "$REMOTE_URL" ]] || die "Usage: $0 <git-remote-url> [branch]"
[[ -d "$LIVE_DIR" ]] || die "${LIVE_DIR} does not exist."
[[ ! -d "${LIVE_DIR}/.git" ]] || die "${LIVE_DIR} is already a git repo. Use scripts/vps-deploy.sh instead."
[[ -f "${LIVE_DIR}/docker-compose.prod.yml" ]] || die "Missing ${LIVE_DIR}/docker-compose.prod.yml."
[[ -f "${LIVE_DIR}/.env.production" ]] || die "Missing ${LIVE_DIR}/.env.production; aborting before any changes."
[[ ! -e "$ROLLBACK_DIR" ]] || die "Rollback path already exists: ${ROLLBACK_DIR}"

POSTGRES_USER="$(read_env POSTGRES_USER "${LIVE_DIR}/.env.production")"
POSTGRES_DB="$(read_env POSTGRES_DB "${LIVE_DIR}/.env.production")"
POSTGRES_PASSWORD="$(read_env POSTGRES_PASSWORD "${LIVE_DIR}/.env.production")"

echo "Taking pre-clone Postgres dump: ${DB_DUMP}"
compose_in "$LIVE_DIR" exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom > "$DB_DUMP"
[[ -s "$DB_DUMP" ]] || die "Postgres dump is zero bytes: ${DB_DUMP}"
echo "Postgres dump OK: ${DB_DUMP}"

echo "Backing up production env: ${ENV_BACKUP}"
cp "${LIVE_DIR}/.env.production" "$ENV_BACKUP"
chmod 600 "$ENV_BACKUP"
[[ -s "$ENV_BACKUP" ]] || die "Env backup is missing or empty: ${ENV_BACKUP}"

echo "Stopping production containers without removing volumes."
compose_in "$LIVE_DIR" down

echo "Renaming live directory to rollback path: ${ROLLBACK_DIR}"
mv "$LIVE_DIR" "$ROLLBACK_DIR"

echo "Cloning ${REMOTE_URL} into ${LIVE_DIR}"
git clone "$REMOTE_URL" "$LIVE_DIR"
cd "$LIVE_DIR"
git checkout "$BRANCH"

echo "Restoring VPS-only .env.production"
cp "$ENV_BACKUP" "${LIVE_DIR}/.env.production"
chmod 600 "${LIVE_DIR}/.env.production"

echo "Starting production stack from git checkout."
compose_in "$LIVE_DIR" up -d --build

echo "Running verification."
DB_OK=0
HTTP_OK=0
if wait_for_user_count "$LIVE_DIR" "$POSTGRES_USER" "$POSTGRES_DB" "$POSTGRES_PASSWORD"; then
  DB_OK=1
fi
if wait_for_http_health; then
  HTTP_OK=1
fi

echo "Rollback directory: ${ROLLBACK_DIR}"
echo "Keep ${ROLLBACK_DIR} for a few days until the git checkout is proven stable."

if [[ "$DB_OK" -eq 1 && "$HTTP_OK" -eq 1 ]]; then
  echo "PASS: VPS bootstrap completed."
else
  die "Bootstrap completed but verification failed. Use ${ROLLBACK_DIR} and ${DB_DUMP} for rollback."
fi
