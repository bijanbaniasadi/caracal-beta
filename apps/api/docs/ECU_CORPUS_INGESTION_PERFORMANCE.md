# ECU Corpus Ingestion Performance

Date: 2026-05-24
Dataset: `C:\Users\Bijan\Desktop\SAFE\Damos and files`
Estimated corpus size: ~319,672 files

## Runtime Architecture

- Discovery, fingerprinting, relation extraction, clustering, and signature generation are split into BullMQ stages.
- Discovery uses batched bulk upserts, a persistent hash cache, checkpoint rows, and resumable sorted path traversal.
- Fingerprinting uses partial-region analysis by default and stores reusable classifier/signature inputs for later stages.
- Relation extraction rebuilds staged relation rows from stored fingerprints, so incremental scans can skip file reads and still regenerate signatures.
- PM2 and Docker Compose now run a separate ECU corpus worker process with environment-driven concurrency and memory limits.

## Benchmark Commands

Cold 1,000-file slice:

```powershell
pnpm --filter @caracal/api ecu:benchmark -- --root="C:\Users\Bijan\Desktop\SAFE\Damos and files" --max-files=1000 --batch-size=500 --fingerprint-batch-size=50 --max-analysis-bytes=65536
```

Mixed incremental 1,500-file slice:

```powershell
pnpm --filter @caracal/api ecu:benchmark -- --root="C:\Users\Bijan\Desktop\SAFE\Damos and files" --max-files=1500 --batch-size=500 --fingerprint-batch-size=50 --max-analysis-bytes=65536
```

## Throughput Metrics

Cold run `cmpjylbrz0000mq29ohg1wtgw`:

| Stage          |          Files |   Time |              Throughput | Peak RSS |
| -------------- | -------------: | -----: | ----------------------: | -------: |
| Discovery      |  1,000 changed | 11.38s |         87.86 files/sec | 143.8 MB |
| Fingerprinting |          1,000 | 48.74s |         20.52 files/sec | 291.3 MB |
| Clustering     |          1,000 |  0.73s |      1,369.86 files/sec | 292.3 MB |
| Signatures     | 644 signatures |  0.26s | 2,448.67 signatures/sec | 291.5 MB |

Mixed incremental run `cmpjyrloy0000x8edpt8zxpp6`:

| Stage               |                     Files |   Time |              Throughput | Peak RSS |
| ------------------- | ------------------------: | -----: | ----------------------: | -------: |
| Discovery           | 500 changed, 1,000 cached |  7.06s |        212.43 files/sec | 134.4 MB |
| Fingerprinting      |                       500 | 11.63s |         42.98 files/sec | 201.9 MB |
| Relation extraction |                     1,500 |  4.24s |        353.44 files/sec | 265.8 MB |
| Clustering          |                     1,500 |  0.89s |      1,677.85 files/sec | 256.1 MB |
| Signatures          |          1,063 signatures |  0.30s | 3,591.22 signatures/sec | 264.9 MB |

## Database Metrics

After the mixed incremental run:

- Database size: 57 MB
- `EcuCorpusRelationStage`: 24 MB, 15,923 rows for latest run
- `EcuBinaryFingerprint`: 8,064 kB, 1,500 latest-run fingerprints
- `EcuCorpusFile`: 4,016 kB, 1,500 latest-run files
- `EcuFileHashCache`: 2,176 kB, 1,500 cached paths
- `EcuFileClusterMember`: 1,320 kB
- `EcuLearnedSignature`: 992 kB
- `EcuFileCluster`: 456 kB

Integrity check for `cmpjyrloy0000x8edpt8zxpp6`:

- Files: 1,500
- Fingerprints: 1,500
- Missing fingerprints: 0
- Unreadable files: 0
- Clusters: 367
- Signatures: 1,063

## Queue Timing Metrics

The benchmark command ran stages synchronously so the BullMQ queues were empty after validation:

- `ecu-corpus-discovery`: waiting 0, active 0, failed 0
- `ecu-corpus-fingerprinting`: waiting 0, active 0, failed 0
- `ecu-corpus-relation-extraction`: waiting 0, active 0, failed 0
- `ecu-corpus-clustering`: waiting 0, active 0, failed 0
- `ecu-corpus-signature-generation`: waiting 0, active 0, failed 0

Worker telemetry is available through `/api/admin/queues/ecu-corpus`, `/api/admin/ecu-corpus/queues`, and `/api/admin/ecu-corpus/runtime/metrics`.

## Bottleneck Analysis

- Fingerprinting is the dominant cold-scan cost because it performs file reads and binary heuristics.
- Discovery is now bounded mostly by full SHA-256 hashing for changed files. Cached files avoid rehashing and were skipped correctly.
- Relation staging is the largest table because it stores reusable token, byte, and family evidence. The unique `(runId, fileId, relationType, relationKey)` key prevents duplicate signature evidence during retries/resume.
- Clustering and signature generation are no longer the bottleneck for the benchmarked slice.

## Estimated Full Scan Duration

For ~320k files:

- Cold end-to-end estimate from the 1,000-file run: ~5.4 hours.
- Cold fingerprinting-only estimate: ~4.3 hours.
- Cold discovery-only estimate: ~1.0 hour.
- Mixed incremental estimate from the 1,500-file run with 1,000 cached files: ~1.4 hours end-to-end for a similar cache ratio.

Actual full duration will vary with file size distribution, archive density, disk throughput, and worker concurrency.
