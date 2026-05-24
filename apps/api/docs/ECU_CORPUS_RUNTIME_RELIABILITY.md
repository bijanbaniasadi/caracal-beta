# ECU Corpus Runtime Reliability

Date: 2026-05-24

Scope: runtime reliability and observability only. No ECU parser, classifier, or map-editing behavior is changed.

## Runtime Probes

- `GET /health/live`: process liveness.
- `GET /health/ready`: database plus Redis/BullMQ readiness.
- `GET /health/runtime`: process memory/resource usage and ECU corpus queue snapshot.
- `GET /metrics`: Prometheus exposition.
- `GET /api/admin/ecu-corpus/runtime/dashboard`: JSON runtime dashboard for queues, bottlenecks, and ingest metrics.
- `GET /api/admin/ecu-corpus/runtime/bottlenecks`: slow-stage, memory-hotspot, and failure summary.

## Prometheus Metrics

Key metrics:

- `caracal_ecu_corpus_stage_duration_seconds`
- `caracal_ecu_corpus_stage_files_total`
- `caracal_ecu_corpus_files_per_second`
- `caracal_ecu_corpus_queue_depth`
- `caracal_ecu_corpus_queue_latency_seconds`
- `caracal_ecu_corpus_queue_backpressure`
- `caracal_ecu_corpus_worker_memory_bytes`
- `caracal_ecu_corpus_stalled_jobs_total`
- `caracal_ecu_corpus_redis_errors_total`
- `caracal_db_operation_duration_seconds`
- `caracal_db_retry_total`

Grafana import: `apps/api/observability/grafana/ecu-corpus-runtime-dashboard.json`.

## Production Controls

Environment knobs:

- `ECU_CORPUS_WORKER_CONCURRENCY`
- `ECU_CORPUS_WORKER_MEMORY_LIMIT_BYTES`
- `ECU_CORPUS_QUEUE_BACKPRESSURE_MAX_DEPTH`
- `ECU_CORPUS_QUEUE_BACKPRESSURE_TIMEOUT_MS`
- `ECU_CORPUS_QUEUE_BACKPRESSURE_POLL_MS`
- `ECU_CORPUS_QUEUE_ATTEMPTS`
- `ECU_CORPUS_QUEUE_BACKOFF_MS`
- `ECU_CORPUS_QUEUE_LOCK_DURATION_MS`
- `ECU_CORPUS_QUEUE_STALLED_INTERVAL_MS`
- `ECU_CORPUS_QUEUE_MAX_STALLED_COUNT`
- `RUNTIME_MEMORY_SAMPLE_INTERVAL_MS`
- `RUNTIME_MEMORY_LEAK_WINDOW`
- `RUNTIME_MEMORY_LEAK_GROWTH_BYTES`
- `DB_RUNTIME_RETRY_ATTEMPTS`
- `DB_RUNTIME_RETRY_BASE_MS`
- `DB_RUNTIME_RETRY_MAX_MS`
- `WORKER_SHUTDOWN_TIMEOUT_MS`

Docker Compose now uses `restart: unless-stopped`, graceful stop windows, API readiness health checks, and a worker Redis connectivity health check. PM2 now disables watch mode for production processes and carries queue/memory/shutdown settings into worker env.

## Reliability Commands

Long-duration stress test with a generated corpus:

```powershell
pnpm --filter @caracal/api ecu:stress -- --duration-ms=3600000 --simulate-files=50000 --max-files=5000
```

Large corpus simulation only:

```powershell
pnpm --filter @caracal/api ecu:reliability -- simulate-corpus --files=100000 --size-bytes=4096 --root=C:\tmp\ecu-corpus-sim
```

Backpressure failure injection:

```powershell
pnpm --filter @caracal/api ecu:failure-injection -- --mode=backpressure
```

Bad-root failure injection:

```powershell
pnpm --filter @caracal/api ecu:failure-injection -- --mode=bad-root
```

Graceful shutdown validation:

```powershell
pnpm --filter @caracal/api ecu:reliability -- graceful-shutdown --timeout-ms=10000
```

Crash recovery validation:

```powershell
pnpm --filter @caracal/api ecu:reliability -- crash-recovery --timeout-ms=10000
```

Queue snapshot:

```powershell
pnpm --filter @caracal/api ecu:reliability -- queue-snapshot
```

## Failure Expectations

- Redis/BullMQ errors increment metrics, mark heartbeat errors, and remain visible in structured logs.
- Database transient errors are retried with bounded exponential backoff and exported as retry counters.
- Memory pressure emits structured warnings and Prometheus counters; workers fail the current job if RSS exceeds the hard limit.
- Queue backpressure delays enqueueing downstream stages and fails fast after the configured timeout.
- Stalled jobs are handled by BullMQ stalled recovery settings and surfaced through metrics/logs.
