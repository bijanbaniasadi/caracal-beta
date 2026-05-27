#!/usr/bin/env bash
set -euo pipefail

LIVE_DIR="/var/www/caracaltech"
DEFAULT_BRANCH="production-vps-fixes"
BRANCH="${1:-$DEFAULT_BRANCH}"
TIMESTAMP="$(date -u +%Y%m%d%H%M%S)"
DB_DUMP="/root/caracal_db_predeploy_${TIMESTAMP}.dump"

die() {
  echo "FAIL: $*" >&2
  exit 1
}

compose() {
  docker compose -f docker-compose.prod.yml --env-file .env.production "$@"
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

assert_no_tracked_drift() {
  local dirty=""
  local line path

  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    path="${line:3}"
    if [[ "$path" == *" -> "* ]]; then
      path="${path##* -> }"
    fi
    if [[ "$path" != ".env.production" && "$path" != backups/* ]]; then
      dirty+="${line}"$'\n'
    fi
  done < <(git status --porcelain --untracked-files=no)

  if [[ -n "$dirty" ]]; then
    echo "Tracked-file drift detected:" >&2
    echo "$dirty" >&2
    die "Commit, revert, or inspect VPS-local tracked changes before deploying."
  fi
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

[[ "$(pwd -P)" == "$LIVE_DIR" ]] || die "Run this script from ${LIVE_DIR}."
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "${LIVE_DIR} is not a git repo. Run scripts/vps-bootstrap.sh first."
[[ -f .env.production ]] || die "Missing .env.production in ${LIVE_DIR}."
[[ -f docker-compose.prod.yml ]] || die "Missing docker-compose.prod.yml in ${LIVE_DIR}."
[[ "$(git branch --show-current)" == "$BRANCH" ]] || die "Current branch must be ${BRANCH}."

assert_no_tracked_drift

POSTGRES_USER="$(read_env POSTGRES_USER .env.production)"
POSTGRES_DB="$(read_env POSTGRES_DB .env.production)"
POSTGRES_PASSWORD="$(read_env POSTGRES_PASSWORD .env.production)"

echo "Taking pre-deploy Postgres dump: ${DB_DUMP}"
compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom > "$DB_DUMP"
[[ -s "$DB_DUMP" ]] || die "Postgres dump is zero bytes: ${DB_DUMP}"
echo "Postgres dump OK: ${DB_DUMP}"

echo "Pulling ${BRANCH} with fast-forward only."
git pull --ff-only origin "$BRANCH"

echo "Building api and web images."
compose build api web

echo "Applying Prisma migrations through the api service."
compose run --rm api pnpm --filter @caracal/api migrate:deploy

echo "Starting updated production stack."
compose up -d

echo "Running health verification."
if wait_for_http_health; then
  echo "PASS: VPS deploy completed."
else
  die "Deploy finished but health verification failed. Pre-deploy dump: ${DB_DUMP}"
fi
