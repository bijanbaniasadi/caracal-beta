# Caracal Tech — Deployment & Operations Runbook

**Stack:** Next.js 15 (web) · Express + Prisma + BullMQ (API) · PostgreSQL 15 · Redis 7  
**Runtime:** Node 20 LTS · pnpm 8 workspaces · PM2 (bare-metal) or Docker Compose (containerised)

---

## 1. Environment Variables

### 1.1 Required — API (`apps/api`)

| Variable | Example / Default | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Must be `production` in prod; enables cookie security, removes dev fallbacks |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | Prisma connection string; supports pgbouncer with `?pgbouncer=true` |
| `REDIS_URL` | `redis://:pass@host:6379` | Used by BullMQ and all queue workers |
| `JWT_SECRET` | ≥32-char random string | HMAC-SHA256 access token signing; **throws on startup if absent in prod** |
| `REFRESH_TOKEN_SECRET` | ≥32-char random string | Refresh token signing; **throws on startup if absent in prod** |
| `API_PORT` | `3001` | HTTP listen port |
| `CORS_ORIGINS` | `https://caracaltech.com,https://admin.caracaltech.com` | Comma-separated; omit for `*` (dev only) |

### 1.2 Required — Web (`apps/web`)

| Variable | Example | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.caracaltech.com` | Browser-side API base URL; must be reachable from the client |

### 1.3 Storage — one of LOCAL or R2

| Variable | Default | Notes |
|---|---|---|
| `LOCAL_UPLOAD_DIR` | `./apps/api/uploads` | Used when `STORAGE_PROVIDER=local` or unset |
| `R2_ENDPOINT` | — | Cloudflare R2 S3-compatible URL |
| `R2_ACCESS_KEY_ID` | — | R2 API token |
| `R2_SECRET_ACCESS_KEY` | — | R2 secret |
| `R2_BUCKET` | — | Bucket name |
| `R2_REGION` | `auto` | R2 region (usually `auto`) |

### 1.4 Auth tuning (optional — safe defaults shown)

| Variable | Default | Notes |
|---|---|---|
| `ACCESS_TOKEN_TTL_SECONDS` | `900` | 15 min; reduce if session theft is a concern |
| `REFRESH_TOKEN_TTL_SECONDS` | `2592000` | 30 days |
| `BCRYPT_ROUNDS` | `12` | Increase to 13–14 on high-spec hardware |
| `AUTH_COOKIE_SECURE` | auto (`true` in prod) | Force `true` if reverse proxy strips HTTPS flag |
| `AUTH_REFRESH_COOKIE_NAME` | `caracal_refresh_token` | |
| `AUTH_RATE_LIMIT_MAX` | `10` | Auth endpoint burst limit per IP per window |
| `UPLOAD_RATE_LIMIT_MAX` | `20` | BIN upload burst limit |

### 1.5 BIN analysis worker (optional — defaults shown)

| Variable | Default | Notes |
|---|---|---|
| `BIN_ANALYSIS_WORKER_CONCURRENCY` | `2` | Parallel jobs per worker process |
| `BIN_ANALYSIS_MAX_ATTEMPTS` | `3` | Retry cap before marking FAILED |
| `BIN_ANALYSIS_RETRY_BACKOFF_MS` | `5000` | Base backoff; doubles each retry |
| `BIN_ANALYSIS_STALLED_AFTER_MS` | `60000` | Job considered stalled after 1 min silence |
| `BIN_ANALYSIS_STALLED_INTERVAL_MS` | `30000` | How often to check for stalls |
| `BIN_UPLOAD_MAX_SIZE` | `67108864` | 64 MB; override for larger BIN files |
| `WORKER_SHUTDOWN_TIMEOUT_MS` | `30000` | Grace period for in-flight jobs before SIGKILL |

### 1.6 ECU corpus worker (optional — defaults shown)

| Variable | Default | Notes |
|---|---|---|
| `ECU_CORPUS_ROOT` | `/data/ecu-corpus` | Host path mounted into the corpus worker |
| `ECU_CORPUS_WORKER_CONCURRENCY` | `2` | Parallel corpus pipeline jobs |
| `ECU_CORPUS_DISCOVERY_BATCH_SIZE` | `2000` | Files hashed per Prisma upsert batch |
| `ECU_CORPUS_FINGERPRINT_BATCH_SIZE` | `100` | Files fingerprinted per batch |
| `ECU_CORPUS_MAX_ANALYSIS_BYTES` | `262144` | Max bytes read per file for entropy/signature analysis (256 KB) |
| `ECU_CORPUS_QUEUE_BACKPRESSURE_MAX_DEPTH` | `5000` | Pause new enqueues above this queue depth |
| `ECU_CORPUS_WORKER_MEMORY_LIMIT_BYTES` | `1610612736` | Self-shutdown threshold (1.5 GB RSS) |

### 1.7 Observability (optional)

| Variable | Default | Notes |
|---|---|---|
| `LOG_LEVEL` | `info` | pino log level: `fatal` `error` `warn` `info` `debug` `trace` |
| `RUNTIME_MEMORY_SAMPLE_INTERVAL_MS` | `15000` | Memory monitor polling interval |
| `RUNTIME_MEMORY_WARNING_RSS_BYTES` | `1073741824` | Warn log at 1 GB RSS |
| `RUNTIME_MEMORY_LEAK_WINDOW` | `8` | Consecutive rising samples before leak warning |
| `RUNTIME_MEMORY_LEAK_GROWTH_BYTES` | `134217728` | Growth over window that triggers leak warning (128 MB) |
| `DB_RUNTIME_RETRY_ATTEMPTS` | `4` | Prisma retry attempts on transient errors |
| `DB_RUNTIME_RETRY_BASE_MS` | `200` | Base retry delay |
| `DB_RUNTIME_RETRY_MAX_MS` | `5000` | Max retry delay cap |

### 1.8 PM2-specific (bare-metal only)

| Variable | Default | Notes |
|---|---|---|
| `API_PM2_EXEC_MODE` | `fork` | Use `cluster` for multi-core API (stateless only) |
| `API_PM2_INSTANCES` | `1` | Number of API processes |
| `API_PM2_MAX_MEMORY` | `512M` | API RSS restart threshold |
| `WORKER_PM2_MAX_MEMORY` | `768M` | BIN worker RSS restart threshold |
| `ECU_CORPUS_WORKER_PM2_MAX_MEMORY` | `1536M` | ECU corpus worker RSS restart threshold |
| `PM2_KILL_TIMEOUT_MS` | `30000` | PM2 SIGKILL grace period (must be ≥ `WORKER_SHUTDOWN_TIMEOUT_MS`) |

---

## 2. PM2 — Bare-Metal Deployment

### 2.1 First-time setup

```bash
# Install dependencies and build
pnpm install --frozen-lockfile
pnpm -r build

# Run Prisma migrations
cd apps/api && npx prisma migrate deploy && cd ../..

# Start all processes
pm2 start ecosystem.config.cjs
pm2 save          # persist process list across reboots
pm2 startup       # print and run the systemd/init command shown
```

### 2.2 Process list

| PM2 name | Script | Role |
|---|---|---|
| `caracal-api` | `dist/server.js` | HTTP API, admin routes, health endpoints |
| `caracal-bin-analysis-worker` | `dist/workers/bin-analysis-worker.js` | BullMQ consumer for BIN upload analysis |
| `caracal-ecu-corpus-worker` | `dist/workers/ecu-corpus-worker.js` | ECU corpus ingestion pipeline |

### 2.3 Day-to-day commands

```bash
pm2 status                          # overview of all processes
pm2 logs caracal-api --lines 100    # tail API logs
pm2 logs caracal-ecu-corpus-worker  # tail corpus worker logs

# Zero-downtime API reload (cluster mode only)
pm2 reload caracal-api

# Hard restart (fork mode)
pm2 restart caracal-api

# Restart all
pm2 restart all
```

### 2.4 Deploy new version

```bash
git pull
pnpm install --frozen-lockfile
pnpm -r build
cd apps/api && npx prisma migrate deploy && cd ../..
pm2 restart all --update-env
```

---

## 3. Docker Compose Deployment

### 3.1 Required `.env` file (repo root)

```dotenv
# Core (required)
DATABASE_URL=postgresql://caracal:STRONG_PASS@postgres:5432/caracal_db
REDIS_URL=redis://:REDIS_PASS@redis:6379
JWT_SECRET=<openssl rand -hex 32>
REFRESH_TOKEN_SECRET=<openssl rand -hex 32>
CORS_ORIGINS=https://caracaltech.com

# Storage
LOCAL_UPLOAD_DIR=/app/apps/api/uploads   # or configure R2 vars

# ECU corpus host path (mounted read-only into corpus worker)
ECU_CORPUS_HOST_PATH=/opt/ecu-corpus     # must exist on host
ECU_CORPUS_ROOT=/data/ecu-corpus         # container path (fixed)

# Optional tuning
ECU_CORPUS_WORKER_CONCURRENCY=2
ECU_CORPUS_DISCOVERY_BATCH_SIZE=2000
BIN_ANALYSIS_WORKER_CONCURRENCY=2
```

### 3.2 Start / stop

```bash
docker compose up -d                  # start all services
docker compose ps                     # check health status
docker compose logs -f api            # follow API logs
docker compose logs -f api-ecu-corpus-worker

# Deploy update
docker compose build
docker compose up -d --no-deps api api-worker api-ecu-corpus-worker
docker compose exec api npx prisma migrate deploy
```

### 3.3 Service dependencies

```
postgres ──► api
             api-worker
redis    ──► api
             api-worker
             api-ecu-corpus-worker
```

Both `api` and the workers wait for `postgres: healthy` and `redis: healthy` before starting.

---

## 4. Redis Requirements

- **Version:** Redis 7+ (Redis 6.2 minimum for BullMQ `LMPOP`)
- **Persistence:** Disabled in the bundled compose (`--save ""`) — queues are ephemeral. Enable AOF or RDB if queue durability across Redis restarts is needed.
- **Memory policy:** Set `maxmemory-policy noeviction` to prevent BullMQ key eviction under memory pressure.
- **Min memory:** 256 MB for light workloads; 1 GB+ for corpus ingestion with >50k queued jobs.
- **TLS:** Pass `rediss://` URL for TLS connections (Redis Cloud, Upstash, etc.).

---

## 5. Health Endpoints

All three endpoints are served by the API at the port defined by `API_PORT`.

| Endpoint | HTTP | Meaning |
|---|---|---|
| `GET /health/live` | Always `200` | Process is running. Used by PM2/Docker restart policy. If this fails, the process has crashed. |
| `GET /health/ready` | `200` OK · `503` Degraded | DB + Redis are reachable. Use for load-balancer health checks. A `503` means the API is up but cannot serve requests reliably — do not route traffic to it. |
| `GET /health/runtime` | `200` | Extended diagnostics: queue counts per stage, memory usage, PID, Node version. Not polled by infrastructure; used for manual inspection. |
| `GET /api/metrics` | `200` text/plain | Prometheus scrape endpoint. Protected by `NODE_ENV` — only exposed when metrics middleware is mounted. |

**Ready probe failure reasons** (check `checks.database.error` / `checks.redis.error` in the 503 body):

- `database: false` → PostgreSQL unreachable or migration lock held. Check `DATABASE_URL`, Prisma migrations, and DB server logs.
- `redis: false` → Redis unreachable. Check `REDIS_URL`, Redis server status, and network connectivity between API and Redis.

---

## 6. Grafana Setup

### 6.1 Bundled Prometheus + Grafana (Docker Compose)

The compose file includes Prometheus and Grafana services. After `docker compose up -d`:

- Grafana: `http://localhost:3000` (default login `admin` / `admin`)
- Prometheus: `http://localhost:9090`

Prometheus auto-discovers the API at `http://api:3001/api/metrics` via the bundled `prometheus.yml`.

### 6.2 Import the pre-built dashboard

```
Grafana → Dashboards → Import → Upload JSON file
File: apps/api/observability/grafana/ecu-corpus-runtime-dashboard.json
```

Dashboard panels:

| Panel | Metric | What to watch |
|---|---|---|
| HTTP request rate | `caracal_http_request_duration_seconds` | p99 > 2s = investigate |
| Queue depth by stage | `caracal_queue_depth` | Rising without workers = stall |
| Worker memory (RSS) | `caracal_worker_memory_rss_bytes` | Approaching `ECU_CORPUS_WORKER_MEMORY_LIMIT_BYTES` = restart imminent |
| DB retry rate | `caracal_db_retry_total` | Sustained retries = connectivity or lock issue |
| Corpus ingestion rate | `caracal_ecu_corpus_stage_duration_seconds` | Stagnant = pipeline blocked |
| Memory leak warnings | `caracal_memory_leak_warnings_total` | Any non-zero = investigate heap growth |

### 6.3 External Prometheus

Point your Prometheus scrape config at `http://<api-host>:3001/api/metrics` with a 15s interval.

---

## 7. Queue Recovery Procedures

### 7.1 BIN analysis queue — jobs stuck in FAILED state

```bash
# Via admin UI
# Admin → BIN Jobs → filter FAILED → Retry (per job)

# Via API (bulk)
curl -X POST http://localhost:3001/api/admin/queues/bin-analysis/cleanup \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Via Redis CLI (nuclear — removes all failed jobs)
redis-cli LRANGE bull:bin-analysis:failed 0 -1
redis-cli DEL bull:bin-analysis:failed
```

### 7.2 ECU corpus pipeline — reset failed jobs

```bash
# Via admin UI
# Admin → ECU Corpus → Run Status → Reset Failed button

# Via API
curl -X POST http://localhost:3001/api/admin/ecu-corpus/reset-failed \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"runId":"<run-id>"}'
```

### 7.3 Pause / resume corpus ingestion

```bash
# Pause (stops new jobs from being processed, in-flight jobs complete)
curl -X POST http://localhost:3001/api/admin/ecu-corpus/pause \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"runId":"<run-id>"}'

# Resume
curl -X POST http://localhost:3001/api/admin/ecu-corpus/resume \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"runId":"<run-id>"}'
```

### 7.4 Backpressure relief — queue depth above `ECU_CORPUS_QUEUE_BACKPRESSURE_MAX_DEPTH`

The corpus worker automatically pauses enqueuing when the queue depth exceeds the backpressure limit. It polls every `ECU_CORPUS_QUEUE_BACKPRESSURE_POLL_MS` (default 2 s) and resumes automatically when depth drops.

If it remains stuck:
1. Check `/health/runtime` to confirm Redis is connected.
2. Increase `ECU_CORPUS_WORKER_CONCURRENCY` and restart the worker.
3. Temporarily raise `ECU_CORPUS_QUEUE_BACKPRESSURE_MAX_DEPTH`.

---

## 8. Stalled Worker Recovery

A BullMQ job is "stalled" when the worker locks it but stops sending heartbeats (process crash, OOM, frozen event loop).

### Detection

```bash
# Check stalled jobs count via health runtime endpoint
curl http://localhost:3001/health/runtime | jq '.queues.stages[].counts.active'

# Or check worker heartbeat age via admin
curl http://localhost:3001/api/admin/queues/health \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.workers'
# Look for workers where isStale = true
```

BullMQ automatically re-queues stalled jobs after `BIN_ANALYSIS_STALLED_AFTER_MS` / `BIN_ANALYSIS_STALLED_INTERVAL_MS`. No manual intervention needed for transient stalls.

### Manual recovery (persistent stall)

```bash
# PM2
pm2 restart caracal-bin-analysis-worker
pm2 restart caracal-ecu-corpus-worker

# Docker
docker compose restart api-worker api-ecu-corpus-worker

# Verify recovery
pm2 logs caracal-bin-analysis-worker --lines 20
```

### Worker self-shutdown on memory limit

The ECU corpus worker monitors RSS every `RUNTIME_MEMORY_SAMPLE_INTERVAL_MS`. When RSS exceeds `ECU_CORPUS_WORKER_MEMORY_LIMIT_BYTES` it logs a critical warning and exits cleanly (in-flight job is re-queued). PM2/Docker `restart: unless-stopped` brings it back automatically.

If restart loops occur (crash every few minutes):
1. Increase `ECU_CORPUS_WORKER_PM2_MAX_MEMORY` / `ECU_CORPUS_WORKER_MEMORY_LIMIT_BYTES`.
2. Reduce `ECU_CORPUS_FINGERPRINT_BATCH_SIZE` to lower per-batch memory footprint.
3. Reduce `ECU_CORPUS_WORKER_CONCURRENCY` to 1.

---

## 9. Production Restart Procedure

### Planned restart (zero data loss)

```bash
# PM2
pm2 reload caracal-api          # graceful (cluster mode) — or:
pm2 restart caracal-api         # immediate (fork mode, <1s downtime)

# Workers drain in-flight jobs within WORKER_SHUTDOWN_TIMEOUT_MS before exit
pm2 restart caracal-bin-analysis-worker
pm2 restart caracal-ecu-corpus-worker

# Docker
docker compose restart api      # sends SIGTERM, waits stop_grace_period: 30s
docker compose restart api-worker api-ecu-corpus-worker
```

### Emergency full restart

```bash
# PM2
pm2 kill && pm2 start ecosystem.config.cjs

# Docker
docker compose down && docker compose up -d
```

### After a migration

Always run migrations before restarting the API when deploying schema changes:

```bash
cd apps/api && npx prisma migrate deploy
pm2 restart caracal-api --update-env
```

Prisma `migrate deploy` is idempotent and safe to run on a running system. The API will begin using the new schema on restart.

---

## 10. Backup Strategy

### 10.1 PostgreSQL

**Full database dump (recommended daily cron):**

```bash
pg_dump \
  --dbname "$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --file="/backups/caracal-$(date +%Y%m%d-%H%M%S).pgdump"
```

**Restore:**

```bash
pg_restore --dbname "$DATABASE_URL" --clean --if-exists /backups/caracal-YYYYMMDD.pgdump
```

**Critical tables (prioritise if doing partial backups):**

| Table | Why critical |
|---|---|
| `User`, `UserSession` | Authentication |
| `BinUpload`, `BinAnalysisJob`, `BinAnalysisResult` | Customer-submitted files and analysis outcomes |
| `EcuCorpusFile`, `EcuBinaryFingerprint`, `EcuFileCluster` | Corpus intelligence; expensive to rebuild |
| `EcuOriModPair`, `EcuMapDefinition`, `EcuProjectLabel` | Derived intelligence; takes hours to regenerate |
| `QuoteRequest`, `ProductInquiry`, `WorkshopConsultation` | Customer leads |
| `Product`, `InventoryItem` | Catalogue data |

**PostgreSQL WAL archiving / continuous backup:** For point-in-time recovery, enable WAL archiving to S3/R2 in `postgresql.conf`. Tools: [pgBackRest](https://pgbackrest.org/) or [Barman](https://pgbarman.org/).

### 10.2 BIN upload files (local storage)

If using `LOCAL_UPLOAD_DIR`:

```bash
# Daily rsync to off-site
rsync -avz --delete /app/apps/api/uploads/ user@backup-host:/backups/uploads/

# Or Docker volume backup
docker run --rm \
  -v api-uploads:/data \
  -v /backups:/out \
  alpine tar czf /out/uploads-$(date +%Y%m%d).tar.gz -C /data .
```

If using Cloudflare R2: objects are replicated across R2's infrastructure. Enable **versioning** on the bucket for point-in-time object recovery.

### 10.3 ECU corpus files

The corpus files under `ECU_CORPUS_ROOT` are **read-only inputs** — they are the ground truth. The database records derived from them (fingerprints, clusters, map definitions) can be **fully regenerated** by re-running a corpus scan:

```bash
curl -X POST http://localhost:3001/api/admin/ecu-corpus/scan/enqueue \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"rootPath":"/data/ecu-corpus"}'
```

Back up the raw corpus files to a separate drive or cloud storage. Do not rely solely on the database for corpus data.

### 10.4 Backup retention policy (suggested)

| Backup type | Frequency | Keep |
|---|---|---|
| Postgres full dump | Daily | 30 days |
| Postgres WAL archive | Continuous | 7 days |
| BIN uploads rsync | Daily | 90 days |
| Grafana dashboard JSON | On change (git) | Indefinite |

---

## 11. Smoke-Test Script

```bash
# Run after every deployment to verify critical paths
cd apps/api && npx tsx scripts/ecu-corpus-reliability.ts
```

Checks: DB connectivity · Redis connectivity · Worker heartbeat age · Queue stall detection · Memory headroom.

Exit 0 = healthy. Non-zero exit = check stdout for failing assertion.

---

## 12. Log Locations

| Context | Path |
|---|---|
| PM2 API | `logs/api/api.combined.log` |
| PM2 BIN worker | `logs/api/bin-worker.combined.log` |
| PM2 corpus worker | `logs/api/ecu-corpus-worker.combined.log` |
| Docker (stdout) | `docker compose logs -f <service>` |
| pino JSON logs | Structured; pipe through `pino-pretty` for human output: `pm2 logs caracal-api \| pino-pretty` |
