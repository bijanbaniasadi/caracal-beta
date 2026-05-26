# Phase 0B.5: Backend Stabilization Plan

## Strategic Rationale

Before investing in frontend UI, the platform must establish:
1. **Reliable search infrastructure** (Typesense decoupled from PostgreSQL writes)
2. **Verifiable data provenance** (no orphan records, full audit trail)
3. **Intelligent confidence scoring** (evidence-based, not guesswork)
4. **Operational maturity** (logging, monitoring, rate limiting)
5. **Performance baseline** (queries benchmarked before users arrive)

The platform's competitive moat is **backend intelligence**, not the React UI. A great search UI on weak data is worthless. These stabilizations must complete before frontend expansion.

## Implementation Schedule

**Week 1: Queue + Provenance + Evidence**
- Queue infrastructure (Redis + BullMQ)
- Compatibility evidence system
- Provenance enforcement
- Dead-letter queue handling

**Week 2: Search + Verification + Indexing**
- Search alias normalization
- Verification aggregation logic
- Typesense projection worker
- Incremental reindexing

**Week 3: Observability + Performance + Contracts**
- Rate limiting + structured logging
- Database performance optimization
- OpenAPI/Swagger generation
- Seed expansion utilities

---

## 1. Search Projection Worker Layer

### Problem
Current architecture: Import API → PostgreSQL → (Maybe) Typesense
- Race conditions if indexing fails
- Stale Typesense data if queue crashes
- No retry logic for failed indexes
- Tight coupling between transactional and search layers

### Solution

**Architecture:**
```
PostgreSQL Write (Import)
    ↓
Event: record_created/updated/deleted
    ↓
BullMQ Queue (search-index)
    ↓
Projection Worker (incremental index)
    ↓
Typesense Collection (async)
```

**Implementation Files:**

```javascript
// src/workers/searchIndexWorker.js
// BullMQ job processor for search indexing
// - Receive record events
// - Transform to Typesense documents
// - Handle partial/full reindex
// - Implement exponential backoff retry
// - Dead-letter queue for persistent failures

// src/services/typesenseProjection.js
// Transform database records to search documents
// - Map vehicles → searchable doc
// - Map ecu_models → searchable doc
// - Map tool_ecu_methods → searchable doc
// - Include search_aliases
// - Include confidence_score
// - Flatten relationships

// src/services/searchIndexQueue.js
// Queue management
// - Create job on record mutation
// - Batch jobs for efficiency
// - Monitor queue health
// - Expose metrics
```

**Database Changes:**
```sql
-- Track indexing status per record
ALTER TABLE vehicles ADD COLUMN indexed_at TIMESTAMP;
ALTER TABLE ecu_models ADD COLUMN indexed_at TIMESTAMP;
ALTER TABLE tool_ecu_methods ADD COLUMN indexed_at TIMESTAMP;

-- Dead-letter queue table
CREATE TABLE search_index_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  job_id VARCHAR(255) NOT NULL,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_retry_at TIMESTAMP
);
```

**Configuration:**
```javascript
// .env
REDIS_URL=redis://localhost:6379
SEARCH_INDEX_BATCH_SIZE=50
SEARCH_INDEX_RETRY_MAX=5
SEARCH_INDEX_RETRY_DELAY_MS=1000
```

**API Changes:**
```javascript
// POST /api/admin/search/reindex
// Trigger full Typesense rebuild
// Requires admin token
// Returns job ID

// GET /api/admin/search/index-status
// Check indexing queue health
// Returns: pending jobs, failed jobs, last index time

// POST /api/admin/search/index-failures/retry
// Retry failed indexing jobs from dead-letter queue
```

**Testing:**
```javascript
// Test scenarios:
// 1. Record created → indexed within 5 seconds
// 2. Record updated → reindexed within 5 seconds
// 3. Queue failure → retry with exponential backoff
// 4. Persistent failure → move to dead-letter queue
// 5. Full rebuild → complete within 30 seconds (100 records)
```

---

## 2. Compatibility Evidence System

### Problem
Current confidence scores are static and unsourced. Over time, as data grows, unverified scores become liabilities.

### Solution

**New Table:**
```sql
CREATE TABLE compatibility_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_ecu_application_id UUID NOT NULL REFERENCES vehicle_ecu_applications(id),
  tool_ecu_method_id UUID REFERENCES tool_ecu_methods(id),
  evidence_type VARCHAR(50) NOT NULL CHECK (evidence_type IN (
    'official_doc',           -- Manufacturer documentation
    'workshop_verified',      -- Verified by tuning workshop
    'successful_read',        -- Successful ECU read recorded
    'successful_write',       -- Successful ECU write recorded
    'community_report',       -- Community report/forum post
    'bench_test',             -- Bench testing verification
    'firmware_analysis'       -- Firmware binary analysis
  )),
  evidence_source VARCHAR(255),      -- URL, person name, workshop ID, etc.
  source_id UUID REFERENCES sources(id),
  evidence_weight INT DEFAULT 0,     -- 0-100, type-specific
  verified_by_admin BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP,
  verified_by UUID,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_compatibility_evidence_app 
  ON compatibility_evidence(vehicle_ecu_application_id);
CREATE INDEX idx_compatibility_evidence_method 
  ON compatibility_evidence(tool_ecu_method_id);
CREATE INDEX idx_compatibility_evidence_type 
  ON compatibility_evidence(evidence_type);
```

**Evidence Weight Defaults:**
```javascript
const EVIDENCE_WEIGHTS = {
  official_doc: 100,        // Manufacturer documentation
  firmware_analysis: 90,    // Binary analysis by expert
  successful_write: 80,     // Confirmed working write
  successful_read: 75,      // Confirmed working read
  workshop_verified: 70,    // Verified by known workshop
  bench_test: 70,           // Bench testing
  community_report: 40,     // Community reports (lower weight)
};
```

**Implementation:**

```javascript
// src/services/evidenceService.js
class EvidenceService {
  // Link evidence to relationships
  async linkEvidence(vehicleEcuAppId, evidenceType, evidenceSource, sourceId) {
    // Validate evidence_type
    // Calculate weight from type
    // Create evidence record
    // Trigger confidence recalculation
  }

  // Get all evidence for a relationship
  async getEvidence(vehicleEcuAppId) {
    // Return all evidence records
    // Sorted by weight descending
    // Include verification status
  }

  // Mark evidence as verified by admin
  async verifyEvidence(evidenceId, userId) {
    // Mark verified_at, verified_by
    // Recalculate confidence
    // Create audit log
  }
}
```

**API Endpoints:**
```javascript
// POST /api/admin/evidence
// Create evidence link
// Body: { vehicleEcuAppId, evidenceType, evidenceSource, sourceId, notes }

// GET /api/vehicle/:vehicleId/evidence
// Get all evidence for a vehicle's applications
// Returns: [{ application, evidenceCount, weights, verification }]

// POST /api/admin/evidence/:evidenceId/verify
// Verify evidence as admin
// Updates confidence scores

// GET /api/admin/evidence/unverified
// Admin view of unverified evidence
// For prioritized review
```

---

## 3. Search Alias Service

### Problem
ECU codes have multiple representations:
- MED17 vs MED 17 vs MED-17
- MG1CS011 vs MG1 CS011
- Bosch MED17.5 vs MED17.5
- Regional names (E-Class W213 vs E-Klasse W213)
- OEM equivalents

Typesense search quality depends on normalizing these variations.

### Solution

**Enhanced search_aliases table:**
```sql
-- Already exists in Phase 0A, enhance with:

ALTER TABLE search_aliases ADD COLUMN
  normalization_rule VARCHAR(255);  -- e.g., "remove_spaces", "collapse_dashes"

-- Examples:
-- primary_term: "MED17.5", alias_term: "MED 17.5", target: ecu_model, market: "EU"
-- primary_term: "MED17.5", alias_term: "MED175", target: ecu_model, market: "EU"
-- primary_term: "MED17.5", alias_term: "Bosch MED17.5", target: ecu_model, market: "EU"
-- primary_term: "E-Class W213", alias_term: "E-Klasse W213", target: vehicle, market: "EU"
```

**Implementation:**

```javascript
// src/services/searchAliasService.js
class SearchAliasService {
  // Normalize search query
  async normalizeQuery(query) {
    // Remove extra spaces
    // Remove dashes/underscores
    // Lowercase
    // Check aliases
    // Return normalized + variants
  }

  // Index aliases for search
  async indexAliasesForTypesense() {
    // Get all aliases
    // Create alias documents in Typesense
    // Link to original records
  }

  // Suggest aliases when creating records
  async suggestAliases(recordType, primaryTerm) {
    // Look up similar existing aliases
    // Suggest common variations
    // Return suggestions for admin approval
  }

  // Bulk import aliases from CSV
  async importAliases(csvContent) {
    // Validate format
    // Check for duplicates
    // Create staging records
    // Preview before commit
  }
}
```

**Typesense Document Enhancement:**
```javascript
// Typesense document structure includes:
{
  id: "ecu_model_uuid",
  type: "ecu_model",
  primary_term: "MED17.5",
  all_terms: [
    "MED17.5", "MED 17.5", "MED175", 
    "Bosch MED17.5", "Motronic MED17.5"
  ],
  family_name: "Motronic MED17",
  market: "EU",
  confidence_score: 85,
  indexed_at: "2026-05-26T..."
}
```

---

## 4. Data Provenance Enforcement

### Problem
Currently records can be imported without clear provenance chain. Makes auditing and data quality assessment impossible.

### Solution

**Enforce at import time:**
```javascript
// src/services/importService.js - modify createImportBatch()

async createImportBatch(tableName, sourceId, records, ...) {
  // Verify source exists
  const source = await db('sources').where('id', sourceId).first();
  if (!source) throw new Error('Invalid source');

  // For each staging record:
  // - Require source_id
  // - Require confidence_score (0-100)
  // - Set retrieved_at to now
  // - Link to source in record_sources BEFORE commit

  // Track provenance metadata:
  batch.source_id = sourceId;
  batch.provenance_chain = {
    original_source: source.name,
    import_timestamp: now(),
    batch_id: batchId,
    record_count: records.length,
    confidence_distribution: { ... }
  };

  // On commit: create record_sources entries ATOMICALLY
  // Never allow record to exist without record_sources link
}
```

**Database Constraint:**
```sql
-- Ensure every production record has at least one source link
CREATE OR REPLACE TRIGGER enforce_provenance
BEFORE INSERT ON vehicles
FOR EACH ROW
EXECUTE FUNCTION check_provenance_exists();

-- Function would be:
-- After INSERT on vehicles, immediately INSERT into record_sources
-- with at least: source_id, confidence_score, created_at
```

**API for provenance query:**
```javascript
// GET /api/vehicle/:vehicleId/provenance
// Returns complete lineage:
// {
//   record: { id, make, model, ... },
//   sources: [
//     { source_id, source_name, confidence, verified_by_admin, imported_at }
//   ],
//   evidence: [ ... ],
//   audit_trail: [ ... ]
// }
```

---

## 5. Verification Aggregation Logic

### Problem
Confidence scores must be calculated from multiple evidence sources, not stored statically.

### Solution

**Confidence Calculation Function (PostgreSQL):**
```sql
CREATE OR REPLACE FUNCTION calculate_aggregated_confidence(
  relationship_id UUID,
  relationship_type VARCHAR(50)
)
RETURNS TABLE (
  raw_confidence INT,
  calculated_confidence INT,
  verification_count INT,
  evidence_breakdown JSONB
) AS $$
DECLARE
  source_creds DECIMAL;
  evidence_weight INT;
  verification_cnt INT;
  evidence_details JSONB;
BEGIN
  -- Get all evidence for relationship
  SELECT COUNT(*), JSONB_AGG(...) INTO verification_cnt, evidence_details
  FROM compatibility_evidence
  WHERE vehicle_ecu_application_id = relationship_id
     OR tool_ecu_method_id = relationship_id;

  -- Calculate from evidence
  -- weight = avg(evidence_weights) + verification_count_bonus
  -- max = 100
  
  -- Return:
  -- raw_confidence (from import)
  -- calculated_confidence (from evidence)
  -- verification_count (evidence links)
  -- evidence_breakdown (types and weights)
END;
$$ LANGUAGE plpgsql;
```

**Service Layer:**
```javascript
// src/services/confidenceService.js
class ConfidenceService {
  // Calculate confidence from evidence
  async calculateConfidence(vehicleEcuAppId) {
    const evidence = await db('compatibility_evidence')
      .where('vehicle_ecu_application_id', vehicleEcuAppId);
    
    // Calculate:
    // - Base: average of evidence weights
    // - Bonus: +5 per verified piece, max +15
    // - Recency: penalize old evidence (>1 year)
    // - Conflicts: detect contradictory evidence
    
    return {
      raw: recordData.confidence_score,      // Original imported score
      calculated: computedScore,              // From evidence
      verificationCount: evidence.length,
      breakdown: {
        official_doc: 0,
        workshop_verified: 2,
        successful_read: 1,
        community_report: 3
      },
      conflictingEvidence: false,
      recommendedScore: maxOf(raw, calculated)
    };
  }

  // Bulk recalculate for all records
  async recalculateAllConfidence() {
    const apps = await db('vehicle_ecu_applications');
    for (const app of apps) {
      const newScore = await this.calculateConfidence(app.id);
      await db('vehicle_ecu_applications')
        .where('id', app.id)
        .update({
          confidence_score: newScore.recommendedScore,
          verification_count: newScore.verificationCount
        });
    }
  }
}
```

---

## 6. Queue Infrastructure (Redis + BullMQ)

### Configuration

**Installation:**
```bash
npm install redis bullmq
```

**Environment:**
```env
REDIS_URL=redis://localhost:6379
QUEUE_NAME_SEARCH_INDEX=search-index
QUEUE_NAME_IMPORT=import-batch
QUEUE_NAME_VERIFICATION=verification-calc
```

**Redis Setup:**
```bash
# Option 1: Docker
docker run -d -p 6379:6379 redis:7-alpine

# Option 2: With docker-compose (add to existing)
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
```

**Queue Services:**

```javascript
// src/services/queueManager.js
class QueueManager {
  constructor() {
    this.searchIndexQueue = new Queue('search-index', { connection });
    this.importQueue = new Queue('import-batch', { connection });
    this.verificationQueue = new Queue('verification-calc', { connection });
  }

  // Search indexing queue
  async enqueueIndexing(recordType, recordId, priority = 'normal') {
    return this.searchIndexQueue.add(
      'index-record',
      { recordType, recordId },
      { priority: priorityToNumber(priority), delay: 1000 }
    );
  }

  // Batch processing queue
  async enqueueBatchProcessing(batchId) {
    return this.importQueue.add(
      'process-batch',
      { batchId },
      { priority: 'high' }
    );
  }

  // Verification recalculation
  async enqueueVerificationCalc(relationshipId) {
    return this.verificationQueue.add(
      'recalc-confidence',
      { relationshipId },
      { priority: 'normal' }
    );
  }

  // Health check
  async getQueueHealth() {
    return {
      searchIndex: {
        pending: await this.searchIndexQueue.getWaitingCount(),
        active: await this.searchIndexQueue.getActiveCount(),
        failed: await this.searchIndexQueue.getFailedCount(),
        delayed: await this.searchIndexQueue.getDelayedCount()
      },
      import: { ... },
      verification: { ... }
    };
  }
}
```

**Worker Implementation:**

```javascript
// src/workers/searchIndexWorker.js
async function startSearchIndexWorker() {
  const queue = new Queue('search-index', { connection });
  
  queue.process('index-record', async (job) => {
    const { recordType, recordId } = job.data;
    
    try {
      // Get record from PostgreSQL
      const record = await db(recordType).where('id', recordId).first();
      
      // Transform to Typesense doc
      const doc = transformToSearchDoc(recordType, record);
      
      // Index in Typesense
      await typesense.collections(recordType).documents().upsert(doc);
      
      // Mark as indexed
      await db(recordType)
        .where('id', recordId)
        .update({ indexed_at: new Date() });
      
      return { success: true, indexed: recordId };
    } catch (error) {
      // Exponential backoff retry
      if (job.attemptsMade < 5) {
        throw error; // BullMQ will retry
      } else {
        // Move to dead-letter queue
        await db('search_index_failures').insert({
          record_type: recordType,
          record_id: recordId,
          job_id: job.id,
          error_message: error.message,
          retry_count: job.attemptsMade
        });
        throw new Error('Max retries exceeded, moved to dead-letter');
      }
    }
  });
}
```

---

## 7. API Rate Limiting + Structured Logging

### Rate Limiting

```javascript
// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,          // 1 minute
  max: 100,                      // requests per window
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip admin endpoints with token
  skip: (req) => req.user?.isAdmin,
  // Key by IP + endpoint
  keyGenerator: (req) => `${req.ip}:${req.path}`
});

// Apply to public search endpoints
router.use('/api/search', apiLimiter);

// Stricter limit for import uploads
const importLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,  // 5 uploads per minute
  skip: (req) => !req.user
});

router.use('/api/admin/import/upload', importLimiter);
```

### Structured Logging

```javascript
// src/utils/structuredLogger.js
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

// Middleware for request logging
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || uuid();
  req.correlationId = correlationId;

  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: Date.now() - start,
      userId: req.user?.userId,
      ip: req.ip,
      timestamp: new Date()
    });
  });

  next();
});

// Usage in code:
logger.info({
  correlationId: req.correlationId,
  event: 'batch_committed',
  batchId,
  recordCount,
  duration: commitTime
});
```

---

## 8. Database Performance Layer

### Benchmark Queries

```javascript
// src/utils/performanceBenchmark.js
async function benchmarkQueries() {
  const queries = [
    {
      name: 'VIN Candidate Search',
      query: async () => db('vehicles')
        .where('is_active', true)
        .whereRaw('? ILIKE CONCAT(vin_pattern, \'%\')', ['WDB'])
        .select()
    },
    {
      name: 'Part Number Fuzzy Search',
      query: async () => db('ecu_part_numbers')
        .whereRaw('UPPER(part_number) LIKE UPPER(?)', ['%6229061800%'])
        .leftJoin('ecu_models', ...)
        .select()
    },
    {
      name: 'Vehicle Compatibility Matrix',
      query: async () => db.from('vehicle_ecu_compatibility')
        .where('vehicle_id', '<uuid>')
        .select()
    }
  ];

  const results = {};
  for (const test of queries) {
    const times = [];
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      await test.query();
      times.push(Date.now() - start);
    }
    results[test.name] = {
      min: Math.min(...times),
      max: Math.max(...times),
      avg: times.reduce((a,b) => a+b) / times.length,
      p95: percentile(times, 0.95)
    };
  }
  return results;
}
```

### Index Analysis

```sql
-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find missing indexes on foreign keys
SELECT tc.constraint_name, kcu.column_name, pg_size_pretty(pg_relation_size(indexname::regclass))
FROM information_schema.table_constraints tc
WHERE constraint_type = 'FOREIGN KEY';

-- Add partial indexes for common filters
CREATE INDEX idx_vehicles_active_make 
  ON vehicles(make) WHERE is_active = true;

CREATE INDEX idx_ecu_applications_confidence_high
  ON vehicle_ecu_applications(confidence_score) WHERE confidence_score >= 80;
```

---

## 9. OpenAPI/Swagger Generation

```javascript
// src/utils/openapi-generator.js
const swaggerAutogen = require('swagger-autogen');

const doc = {
  info: {
    title: 'CaracalTech ECU Intelligence API',
    description: 'Phase 0B.5 Stable Release',
    version: '0.2.0'
  },
  host: 'api.caracaltech.local',
  basePath: '/api',
  schemes: ['http', 'https'],
  securityDefinitions: {
    bearerAuth: {
      type: 'apiKey',
      name: 'Authorization',
      in: 'header'
    }
  }
};

const outputFile = './swagger-output.json';
const routes = ['./src/routes/search.js', './src/routes/admin.js'];

swaggerAutogen(outputFile, routes, doc);
```

**API Contract:**
```
GET /api/search/vin - Query params, 200 response schema
GET /api/search/part-number - Query params, 200 response schema
POST /api/admin/import/upload - Multipart, 200 response schema
POST /api/admin/import/:batchId/commit - 200 response schema
...
```

---

## 10. Seed Expansion Utilities

### Fixture Generation

```javascript
// src/utils/seedGenerator.js
class SeedGenerator {
  // Generate deterministic test data
  generateVehicles(count = 50) {
    const makes = ['Mercedes-Benz', 'BMW', 'Audi', 'Ford', 'Toyota'];
    const models = ['E-Class', '3-Series', 'A4', 'Focus', 'Camry'];
    
    return Array(count).fill().map((_, i) => ({
      id: uuid(),
      make: makes[i % makes.length],
      model: models[i % models.length],
      year_start: 2010 + Math.floor(i / 10),
      year_end: 2020 + Math.floor(i / 10),
      primary_market: 'EU',
      markets: ['EU', 'GCC']
    }));
  }

  generateEngines(vehicleIds, count = 3) {
    return vehicleIds.flatMap((vehicleId, i) =>
      Array(count).fill().map((_, j) => ({
        id: uuid(),
        vehicle_id: vehicleId,
        engine_code: `ENGINE_${i}_${j}`,
        displacement_cc: 1500 + j * 500,
        cylinders: 4 + j,
        horsepower_stock: 150 + j * 50,
        torque_stock_nm: 250 + j * 50,
        fuel_type: j % 2 === 0 ? 'petrol' : 'diesel'
      }))
    );
  }

  generateEcuApplications(vehicleIds, engineIds, ecuModelIds) {
    // Create region-specific applications
  }
}

// Usage:
async function seed() {
  const vehicles = seedGen.generateVehicles(100);
  await db('vehicles').insert(vehicles);

  const engines = seedGen.generateEngines(
    vehicles.map(v => v.id),
    3
  );
  await db('engines').insert(engines);

  // ... etc
}
```

### Environment Reset

```bash
#!/bin/bash
# scripts/reset-dev-db.sh

echo "Resetting development database..."
docker exec caracaltech_postgres psql -U caracaltech -d caracaltech_ecu -c "DROP SCHEMA public CASCADE;"
docker exec caracaltech_postgres psql -U caracaltech -d caracaltech_ecu -c "CREATE SCHEMA public;"

echo "Running migrations..."
npm run migrate

echo "Seeding test data..."
npm run seed

echo "Indexing Typesense..."
npm run search:reindex

echo "Development database reset complete"
```

---

## Implementation Order

### Week 1 (Priority)
1. **Queue Infrastructure** (Redis + BullMQ setup)
   - This enables everything else
   - Foundational for background indexing

2. **Provenance Enforcement**
   - Add to import pipeline immediately
   - No data can be imported without source
   - Prevents future data quality issues

3. **Compatibility Evidence System**
   - New table + API endpoints
   - Integrate with confidence calculation
   - Enables evidence-based scores

### Week 2 (Integration)
4. **Search Alias Service**
   - Normalize ECU codes
   - Prepare for Typesense projection

5. **Verification Aggregation**
   - Confidence calculation function
   - Recalculate existing records
   - Wire into import commit

6. **Search Projection Worker**
   - Queue-based indexing
   - Typesense projection
   - Dead-letter queue handling

### Week 3 (Operations)
7. **Rate Limiting + Logging**
   - Structured logs
   - Request correlation IDs
   - Rate limits on public endpoints

8. **Database Performance**
   - Benchmark all search queries
   - Add indexes as needed
   - Document performance baseline

9. **OpenAPI Generation**
   - Swagger documentation
   - API contract
   - Frontend reference

10. **Seed Utilities**
    - Fixture generation
    - Repeatable test scenarios
    - Environment reset tooling

---

## Success Criteria

### Week 1
- [ ] Redis running, BullMQ integrated
- [ ] All imports create provenance links
- [ ] Compatibility evidence table populated
- [ ] Evidence API endpoints working

### Week 2
- [ ] Search aliases normalized
- [ ] Confidence recalculation logic correct
- [ ] Typesense projection worker stable
- [ ] Queue health metrics available

### Week 3
- [ ] Rate limiting active
- [ ] Structured logs in all endpoints
- [ ] Search queries < 200ms p95
- [ ] OpenAPI/Swagger contract generated
- [ ] Seed scripts repeatable

---

## Why This Matters

**Without these stabilizations:**
- Typesense gets out of sync with PostgreSQL
- Confidence scores decay without evidence
- Data quality degrades as dataset grows
- No operational visibility into system health
- ECU code variations break search
- No provenance for disputed data

**With these stabilizations:**
- Search always consistent with database
- Confidence scores improve over time
- High data quality at scale
- Complete operational observability
- Search handles code variations
- Verifiable data lineage

---

## Phase 0C Will Build On

Once these 10 stabilizations are solid:
- Frontend UI has reliable search to consume
- Admin panel has confidence scoring to display
- Evidence system provides transparency
- Queue infrastructure scales batch uploads
- Logging provides debugging context
- Performance baseline guides optimization

The platform becomes a **trustworthy intelligence system**, not just a database UI.

---

**Next: Start with Week 1 Phase 0B.5 implementation**
