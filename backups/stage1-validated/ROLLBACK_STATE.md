# Stage 1 — Rollback baseline

Frozen restore point for the layered catalog after Stage 1 MK3 controlled ingestion.
This file is the canonical reference for restoring the local stack to the validated
post-Stage-1 state. Do not edit historical values; append new sections for new freezes.

## Identity

| Field | Value |
|---|---|
| Stage | Stage 1 — MK3 controlled ingestion (validated) |
| Frozen at (UTC) | <FILL_FROM_STEP_4 — output of `(Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")`> |
| Branch | `production-vps-fixes` |
| HEAD commit | `aa21e49ec4c96629d704eb1b0850968c5fe7248b` |
| Git tag | `stage1-mk3-validated` |
| Prior Stage 0 baseline | (none — Stage 0 had no separate snapshot; restorable from migrations + reset) |
| Stage status | functional certification: PASS · checkpoint certification: PENDING remediation per Stage 1 audit |

## Docker topology at freeze time

Compose project root: `C:\Caracaltech website Project`
Compose file: `docker-compose.yml`

| Service | Role | Port (host) | Persistent volume |
|---|---|---|---|
| `postgres` | Source of truth | `5432` | `postgres-data` (Docker volume) |
| `redis` | BullMQ queues, cache | `6379` | none (ephemeral in dev compose) |
| `typesense` | Derived search index | `8108` | `typesense-data` (Docker volume) |
| `api` | Express API | `3001` | `api-uploads`, `api-logs` |
| `api-projection-worker` | Matview + Typesense projection | (no public port) | `api-logs` |
| `api-worker` | BIN analysis | (no public port) | `api-uploads`, `api-logs` |
| `api-ecu-corpus-worker` | ECU corpus indexing (unrelated to catalog) | (no public port) | `api-logs` |

## Validated endpoints at freeze time

| Endpoint | Expected status | Notes |
|---|---|---|
| `GET http://localhost:3001/health/live` | 200 | API liveness |
| `GET http://localhost:3001/health/ready` | 200 | DB + Redis ready |
| `GET http://localhost:3001/api/catalog/products` | 200 with `count: 1`, pagination `total: 1` | One published master from Stage 1 (Autotuner) |
| `GET http://localhost:3001/api/catalog/search?q=Autotuner` | 200 with `found: 1` | Typesense alias resolves |
| `GET http://localhost:3001/api/catalog/health` | 404 | Endpoint intentionally removed (Phase 4 C2 fix) |
| `GET http://localhost:8108/health` | 200 `{ok:true}` | Typesense liveness |
| `GET http://localhost:3000/shop` | 200 | Legacy catalog still serving |
| `GET http://localhost:3000/shop/cart` | 200 | Legacy cart still functional |
| `GET http://localhost:3000/catalog` | 307 → `/shop` with header `x-caracal-catalog-frontend: legacy-rollback` | Rollback gate effective |
| `GET http://localhost:3000/catalog/search?q=Autotuner` | 307 → `/shop?q=Autotuner` with rollback header | Query params preserved |

## Stage 1 ingestion result snapshot

| Metric | Value |
|---|---|
| `ingestion_runs.id` | `4` |
| `vendor_sources.slug` | `mk3` |
| Raw products ingested | `6` |
| Raw images stored | `6` |
| Failed imports | `0` |
| Exact deterministic matches | `1` |
| `review_queue` items created | `5` |
| Unresolved `review_queue` items | `0` |
| Duplicate external URL/SKU count | `1` (expected — fixture asserts idempotent raw upsert) |
| `master_products` in `published` state | `1` (Autotuner) |
| `public_products` matview row count | `1` |
| Typesense indexed product count | `1` |

## Typesense alias snapshot

| Field | Value |
|---|---|
| Alias name | `products` |
| Alias target collection | `products_v_20260526T190918Z` |
| Alias-swap pattern in use | yes (timestamp-suffixed collection) |
| Old collections retained | unverified — confirm before Stage 2 |

## Backup artifacts

Stored under: `backups/stage1-validated/`

| File | Type | Size (bytes) | SHA256 | Notes |
|---|---|---|---|---|
| `stage1.dump` | Postgres custom-format dump (`pg_dump --format=custom`) | `11625168` | `<FILL_FROM_STEP_4 — Get-FileHash stage1.dump>` | Created from `docker compose exec postgres pg_dump -U caracal -d caracal_dev --format=custom` |
| `typesense-stage1/` | Typesense snapshot tree (`/operations/snapshot?snapshot_path=/tmp/stage1`) | `<FILL_FROM_STEP_4 — sum of file sizes>` | `<FILL_FROM_STEP_4 — combined SHA256>` | Copied from container via `docker compose cp typesense:/tmp/stage1` |
| `ROLLBACK_STATE.md` | This file | n/a | n/a | Metadata index |

## Secrets

- `TYPESENSE_API_KEY` is *not* recorded in this file. It is held in the running Docker
  container's environment and in your local `.env` / shell. To restore against a fresh
  Typesense instance, set the same key on the new container before importing the snapshot.
- All Postgres credentials are in the compose file / `.env`; do not duplicate here.

## Restoration procedure (local stack only — no VPS)

> Run from a clean checkout of `production-vps-fixes` at commit `aa21e49`.
> All commands assume PowerShell on Windows and `docker compose` v2.

```powershell
# 0. Stop and clear current containers/volumes (DESTRUCTIVE — confirm first)
docker compose down -v

# 1. Recreate the stack at the validated commit
git checkout aa21e49ec4c96629d704eb1b0850968c5fe7248b
docker compose up -d postgres redis typesense
# Wait for healthy
docker compose ps

# 2. Restore Postgres
docker compose cp backups\stage1-validated\stage1.dump postgres:/tmp/stage1.dump
docker compose exec postgres pg_restore -U caracal -d caracal_dev --clean --if-exists /tmp/stage1.dump

# 3. Restore Typesense from snapshot
#    Typesense restore = stop, replace data dir contents with snapshot, start.
docker compose stop typesense
docker compose cp backups\stage1-validated\typesense-stage1 typesense:/data-restore
docker compose exec typesense sh -c "rm -rf /data/* && cp -a /data-restore/. /data/"
docker compose start typesense

# 4. Bring API and worker back online
docker compose up -d api api-projection-worker

# 5. Verify against the validated endpoints table above
```

## Known issues at this freeze (carry forward to Stage 2)

These are recorded so the freeze is honest, not to block restoration. They come from
the Stage 1 commit audit:

1. Commit `7242648` mixes Stage 1 catalog work with B2B UI, the `caracaltechwebsite/`
   ECU evidence prototype, and orphan files at the repo root. Cannot revert Stage 1 alone.
2. `apps/api/scripts/stage1-mk3-ingestion-validation.ts` writes directly to
   `master_products` (DRAFT-only reference seeding). Move to a dedicated seed script
   before Stage 2 so the "no scraper writes masters" invariant holds for the harness too.
3. Typesense old-collection retention policy not codified. Decide before Stage 2.
4. `backups/` is not in `.gitignore`. If snapshot artifacts grow, add or use Git LFS.

## Validated state — do not modify after freeze

Append-only. Do not edit values above; create a new section if a value changes.
Any change to the artifacts above invalidates this freeze and requires a new
`backups/stage<N>-validated/ROLLBACK_STATE.md` to be written.

---

*End of Stage 1 rollback metadata.*
