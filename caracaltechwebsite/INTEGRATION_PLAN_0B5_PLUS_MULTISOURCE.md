# Integration Plan: Phase 0B.5 + Multi-Source Connector Architecture

**Date**: 2026-05-26  
**Status**: Strategic Planning Phase  
**Objective**: Sequence backend stabilization with multi-source ingestion system

---

## Context

### Current State
- Phase 0B (REST API + 5-stage import pipeline): ✅ COMPLETE
- Phase 0B.5 (Backend stabilization): ⏳ NOT STARTED
- Dataset analysis (AutoTuner): ✅ COMPLETE (AUTOTUNER_MANUAL_ANALYSIS.md)
- Multi-source architecture design: ✅ COMPLETE (MULTI_SOURCE_CONNECTOR_ARCHITECTURE.md)

### User Mandate
> "Do NOT build frontend until: queue architecture, indexing architecture, provenance enforcement, verification logic, evidence model are fully stable. The platform moat is backend intelligence and trust infrastructure, not the React UI."

> "Build a scalable ingestion and normalization framework capable of local dataset ingestion, structured web extraction, compatibility diffing, source conflict detection, evidence attribution."

---

## Three-Phase Implementation Sequence

### **PHASE 1: Backend Stabilization (Week 1-3 of Phase 0B.5)**

**Goal**: Establish rock-solid infrastructure for reliable event-driven data processing

#### Week 1: Event System + Queue Infrastructure + Provenance

**Deliverables**:
- ✅ DomainEvents.js (5 core events)
- ✅ EventBus.js (publish/subscribe)
- ✅ Queue topology (Redis + BullMQ, 6 queues)
- ✅ Provenance enforcement triggers
- ✅ Idempotency key tracking
- ✅ Evidence system schema

**Critical for**:
- Reliable import processing without duplicates
- Decoupling imports from search/verification
- Auditable data provenance
- Foundation for multi-source synchronization

**Files to Create**:
```
backend/
  event-system/
    DomainEvents.js
    EventBus.js
    EventHistoryTrace.js
  queue/
    QueueConfiguration.js
    QueueWorkers.js
  provenance/
    ProvenanceEnforcer.js
    ProveTriggers.sql
  evidence/
    EvidenceService.js
    VerificationEntities.sql
```

#### Weeks 2-3: Verification + Indexing + Materialized Views

**Deliverables**:
- Confidence scoring system
- Materialized view generation
- Search index rebuild infrastructure
- Semantic fingerprinting service
- Rate limiting on critical queues
- OpenAPI documentation

**Files to Create**:
```
backend/
  verification/
    ConfidenceCalculator.js
    ConfidenceSnapshots.sql
  search/
    SearchIndexService.js
    MaterializedViewGenerator.js
  normalization/
    SemanticFingerprinting.js
    SimilarityMatching.js
  monitoring/
    OperationalMetrics.js
```

**Why this order**:
1. Events + queues are foundation for everything
2. Provenance enforcement must be in place before any data import
3. Evidence linking needs to be in schema before import
4. Verification/confidence must be proven before multi-source reconciliation

---

### **PHASE 2: Local Source Ingestion (Week 4-6 of Phase 0B.5)**

**Goal**: Prove ingestion + normalization + reconciliation on known-good local sources

#### Week 4: Connector Framework + AutoTuner Import

**Deliverables**:
- ✅ SourceConnector abstract class
- ✅ LocalJsonConnector implementation
- ✅ AutoTuner import service (raw → normalized → staging)
- ✅ Semantic normalization layer (tested on AutoTuner data)
- ✅ Schema validation
- ✅ Import statistics generation

**Files to Create**:
```
backend/
  connectors/
    SourceConnector.js (abstract)
    LocalJsonConnector.js
    LocalXlsxConnector.js
  ingestion/
    autotuner/
      AutotunerImportService.js
      AutotunerNormalizer.js
      AutotunerValidator.js
  normalization/
    SemanticNormalization.js
    (ECU brand, model, vehicle, method, protocol aliases)
```

**Dataset-specific work**:
```
staging/autotuner/
  autotuner_raw.json (as-is import)
  autotuner_normalized.json (semantically normalized)
  autotuner_staging.json (ready for commit)
  autotuner_import_stats.json
```

**Why AutoTuner first**:
- Simplest structure (no vehicle context)
- Already deduplicated (less reconciliation complexity)
- Pure ECU reference (good for schema validation)
- Foundation for more complex sources (PCMtuner, DFB)

#### Week 5: Cross-Source Reconciliation + Evidence Linking

**Deliverables**:
- ✅ PCMtuner import service
- ✅ DFB import service
- ✅ Entity matching across sources
- ✅ Conflict detection engine
- ✅ Evidence aggregation (AutoTuner + DFB)
- ✅ Consensus calculation
- ✅ Conflict reports for admin review

**Files to Create**:
```
backend/
  ingestion/
    pcmtuner/
      PcmtunerImportService.js
      PcmtunerNormalizer.js
    dfb/
      DfbImportService.js
      DfbNormalizer.js
  reconciliation/
    EntityMatcher.js
    ConflictDetector.js
    EvidenceAggregator.js
    ConsensusCalculator.js
  
admin/
  ConflictReportService.js (generate reports)
  AdminConflictReview.jsx (mock UI)
```

**Expected reconciliation**:
- AutoTuner ECU (e.g., Bosch ME17.3.0) matches DFB verified methods
- DFB evidence linked: "Bosch ME17.3.0 has verified read method" (confidence boost)
- Multi-PROG chip references linked to ECU MCUs

#### Week 6: Admin Conflict Resolution + Commit

**Deliverables**:
- ✅ Conflict review interface (mock)
- ✅ Manual resolution workflow
- ✅ Bulk commit to ecu_models / vehicle_applications
- ✅ Evidence assignment on commit
- ✅ Import audit trail
- ✅ Performance baseline

**Files to Create**:
```
backend/
  admin/
    ConflictResolutionService.js
    AdminCommitService.js
    ImportAuditTrail.sql
  
tests/
  integration/
    ImportWorkflow.test.js (end-to-end)
    ReconciliationEngine.test.js
    PerformanceBaseline.test.js
```

**Why this order**:
1. AutoTuner alone tests basic import pipeline
2. PCMtuner + DFB test reconciliation (they overlap heavily)
3. Admin UI proves conflict resolution is manual (not automatic)
4. Commit step is final, irreversible (strict audit trail)

---

### **PHASE 3: Web Source Connectors (Phase 0C - AFTER 0B.5)**

**Timing**: Only after Phase 0B.5 is complete + local sources committed

**Goal**: Add live vendor data without disrupting stable local import pipeline

#### Scope (not yet implemented):
- WebScraperConnector for Autotuner portal
- WebScraperConnector for KESS3 compatibility
- WebScraperConnector for HP Tuners support
- WebScraperConnector for PCMFlash docs

#### Architecture pattern (same as local):
```
For each online source:
  1. WebScraperConnector reads raw
  2. Normalize to canonical schema
  3. Match against existing entities
  4. Detect changes (via source freshness tracking)
  5. Generate diff events
  6. Aggregate with existing evidence
  7. Flag conflicts for admin review
  8. Commit incrementally
```

**Key difference**: Online sources may update frequently, so:
- Freshness tracking is critical
- Periodic sync scheduler (Phase 0D)
- Change detection minimizes re-processing
- Incremental commits instead of batch

---

## Detailed Week-by-Week Roadmap

### **Week 1 (Phase 0B.5.1): Events, Queues, Provenance**

**Monday-Tuesday**: Event System Foundation
```javascript
// DomainEvents.js - 5 core events
- RecordImportedEvent
- RecordUpdatedEvent
- EvidenceAddedEvent
- CompatibilityVerifiedEvent
- SearchReindexRequiredEvent
```

**Wednesday**: Queue Topology Setup
```
Redis configuration:
  critical: {
    'import-batch',
    'audit-events'
  }
  noncritical: {
    'search-index',
    'search-rebuild'
  }
  cpu-heavy: {
    'verification-calc'
  }
  management: {
    'dead-letter'
  }
```

**Thursday**: Provenance Schema
```sql
-- All production tables get:
  source_id VARCHAR(255) NOT NULL
  retrieved_at TIMESTAMP NOT NULL
  confidence_score DECIMAL(3,2) NOT NULL
  confidence_breakdown JSONB
  
-- Trigger: enforce_provenance (BEFORE INSERT/UPDATE)
-- Prevents any record without source/confidence/retrieved_at
```

**Friday**: Idempotency + Event History
```sql
CREATE TABLE processed_events (
  idempotencyKey VARCHAR(255),
  eventId UUID,
  entityType VARCHAR(100),
  entityId BIGINT,
  action VARCHAR(100),
  result TEXT,
  processedAt TIMESTAMP,
  PRIMARY KEY (idempotencyKey)
);

CREATE TABLE event_history_trace (
  correlationId UUID,
  eventId UUID,
  eventType VARCHAR(100),
  entityType VARCHAR(100),
  entityId BIGINT,
  createdAt TIMESTAMP
);
```

**Deliverable**: Events + Queues + Provenance operational ✅

---

### **Week 2-3 (Phase 0B.5.2-3): Verification, Evidence, Indexing**

**Week 2: Evidence System + Verification Entities**
```sql
-- Evidence model
CREATE TABLE compatibility_evidence (
  id BIGSERIAL PRIMARY KEY,
  entity_type ENUM(...),
  entity_id BIGINT,
  evidence_type VARCHAR(100),
  evidence_weight DECIMAL(3,2),
  verification_entity_id BIGINT REFERENCES verification_entities(id),
  source_id VARCHAR(255),
  created_at TIMESTAMP
);

-- Verification entities
CREATE TABLE verification_entities (
  id BIGSERIAL PRIMARY KEY,
  entity_type ENUM('workshop', 'internal', 'partner', 'anonymous'),
  entity_name VARCHAR(255),
  credibility_score DECIMAL(3,2),
  created_at TIMESTAMP
);
```

**Evidence Service**:
- linkEvidence(entityType, entityId, evidence)
- getEvidence(entityType, entityId)
- getInheritedEvidence(entityType, entityId) // traverses app→ecu→method→firmware
- verifyEvidence(evidence)

**Week 3: Confidence Scoring + Materialized Views**
```javascript
// Confidence calculation
confidence_breakdown = {
  source_weight: 0.40,        // source credibility
  verification_weight: 0.30,   // evidence count
  evidence_weight: 0.20,       // evidence quality
  recency_weight: 0.10,        // recent data > old
  conflict_penalty: -0.15      // conflicting sources
}

// Materialized views (async generation)
CREATE MATERIALIZED VIEW effective_evidence_view AS
  (inheritance logic)
  
CREATE MATERIALIZED VIEW effective_confidence_view AS
  (confidence calculation by entity)
```

**Deliverable**: Evidence + Verification + Confidence operational ✅

---

### **Week 4 (Phase 0B.5.4): AutoTuner Ingestion**

**Monday-Wednesday**: Connector Framework
```javascript
class SourceConnector {
  async readRaw() {}
  async normalize() {}
  async getSourceMetadata() {}
}

class LocalJsonConnector extends SourceConnector {
  // AutoTuner + PCMtuner + Multi-PROG implementation
}
```

**Thursday**: Normalization Layer
```javascript
// SemanticNormalization.js
- normalizeECUBrand() (tested on AutoTuner data)
- normalizeECUModel() (handle protocol qualifiers)
- normalizeVehicleType()
- normalizeVehicleBrand()
- normalizeMethod()
- normalizeProtocol()
- normalizeMCU()
```

**Friday**: AutoTuner Pipeline
```
autotuner_compatibility_full.json
  ↓ readRaw()
autotuner_raw.json (2,066 rows)
  ↓ normalize()
autotuner_normalized.json (semantic rules applied)
  ↓ deduplicate() (validation)
autotuner_deduplicated.json (expecting 767, already deduped)
  ↓ validate()
autotuner_staging.json (ready for commit)
  ↓ generateStats()
autotuner_import_stats.json
```

**Test data**:
- Fingerprinting: Bosch ME17.3.0 on pages 1+2 should deduplicate ✓
- Normalization: EDC16C39 (CAN) + (K-Line) should normalize correctly ✓
- Confidence: AutoTuner records = confidence_score: 40 ✓

**Deliverable**: AutoTuner successfully imported to staging ✅

---

### **Week 5 (Phase 0B.5.5): Cross-Source Reconciliation**

**Monday-Tuesday**: PCMtuner + DFB Ingestion
```
pcmtuner_full_vehicle_database.json (7,076 records)
  → normalized (vehicle brand, model, year, ecu hints)
  → staging

dfb_driver_list_full.json (6,128 records)
  → normalized (ecu_brand, ecu_model, method, status)
  → staging
```

**Wednesday-Thursday**: Reconciliation
```javascript
// Entity Matching
autotuner: (Bosch, ME17.3.0, TC1724) 
→ match against
pcmtuner vehicle records with ecu hints
dfb methods with (Bosch, ME17.3.0)

// Conflict Detection
autotuner: "method unknown"
dfb: "read method verified"
→ agree on: method = read, evidence = DFB verified

// Evidence Aggregation
result = {
  entity: (Bosch, ME17.3.0, TC1724),
  method: 'read',
  sources: [
    {source: autotuner, confidence: 0.40},
    {source: dfb, confidence: 0.70}
  ],
  consensus_method: 'read',
  evidence: [{source: dfb, verified: true}]
}
```

**Friday**: Conflict Reporting
```json
{
  "conflicts_detected": 142,
  "examples": [
    {
      "entity": "Bosch EDC17CV54",
      "conflict": "AutoTuner vs DFB on supported methods",
      "autotuner_claims": ["unknown"],
      "dfb_claims": ["read verified"]
    }
  ],
  "admin_action_required": true
}
```

**Deliverable**: Reconciliation engine operational, conflicts identified ✅

---

### **Week 6 (Phase 0B.5.6): Admin Review + Commit**

**Monday-Wednesday**: Conflict Resolution Workflow
```
Admin view shows:
  - Conflict summary
  - Source comparison
  - Recommendation (consensus vs manual override)
  - Audit trail (who approved, when, why)
  
Admin actions:
  - Accept consensus
  - Override with manual decision
  - Request more evidence
  - Mark as unresolvable
```

**Thursday**: Bulk Commit
```javascript
// CommitService.js
for each staging record:
  1. Check against ecu_models/vehicle_applications
  2. If new: insert + link evidence
  3. If exists: verify source attribution + confidence
  4. Generate audit trail entry
  5. Emit RecordImportedEvent
```

**Friday**: Validation + Baseline
```javascript
// Performance baseline
- Import rate: records/second
- Dedup rate: duplicates detected/total
- Match rate: cross-source entities matched
- Conflict rate: conflicts detected/matches
- Confidence distribution: histogram
```

**Deliverable**: 4 local datasets successfully committed, baseline established ✅

---

## Expected Outcomes by End of Phase 0B.5

### Data State
- **ecu_models table**: 767 (AutoTuner) + 140 (PCMtuner ecu refs) + 180 (DFB ecu methods) → ~1,000 unique ECU specs
- **vehicle_applications table**: 7,076 (PCMtuner base) + conflicts resolved
- **compatibility_evidence table**: 2,100+ evidence links (DFB methods, AutoTuner support)
- **verification_entities table**: 4 base sources + workshop entries

### Infrastructure
- ✅ Event system proven (no lost messages)
- ✅ Queue isolation working (search never starves import)
- ✅ Provenance enforced (100% of records have source/confidence)
- ✅ Evidence inheritance working (queries fast on materialized views)
- ✅ Confidence scoring auditable (snapshots table for all changes)
- ✅ Conflict detection proven (142 conflicts identified, resolved)

### Code Base
```
backend/
  event-system/           (Events, EventBus, history trace)
  queue/                  (Redis, BullMQ, topology)
  provenance/             (Triggers, enforcement)
  evidence/               (Schema, service, linking)
  verification/           (Confidence, snapshots, views)
  connectors/             (SourceConnector, LocalJsonConnector)
  ingestion/              (autotuner/, pcmtuner/, dfb/, multiprog/)
  normalization/          (SemanticNormalization, fingerprinting)
  reconciliation/         (Matching, conflict detection, aggregation)
  search/                 (IndexService, MaterializedViews)
  admin/                  (ConflictResolution, CommitService)
  monitoring/             (Metrics, OpenAPI docs)
  tests/integration/      (Full workflows)
```

### Documentation
- ✅ AutoTuner Manual Analysis (this dataset)
- ✅ Multi-Source Connector Architecture (design)
- ✅ Week 1 Locked Plan (backend stabilization)
- ✅ Integration Plan (this document)
- ✅ OpenAPI specs (all endpoints)
- ✅ Performance baseline report

---

## Constraints & Principles

### Do NOT

❌ Build frontend before Phase 0B.5 complete  
❌ Optimize search before having real data  
❌ Auto-resolve conflicts (manual review required)  
❌ Directly ingest web data to production (staging first)  
❌ Skip provenance enforcement  
❌ Remove deduplication (even small sources need it)  
❌ Trust any single source without triangulation  

### DO

✅ Prove every component with real datasets  
✅ Maintain audit trail for compliance  
✅ Make conflicts visible to admin, not hidden  
✅ Source attribution is non-negotiable  
✅ Evidence must be linkable and traceable  
✅ Test reconciliation on overlapping sources  
✅ Baseline performance before scaling  

---

## Success Criteria for Phase 0B.5

**Week 1**: Events + Queues + Provenance operational
- ✅ DomainEvents created and published
- ✅ Queue workers processing without errors
- ✅ Provenance triggers blocking non-attributed data
- ✅ Idempotency keys preventing duplicates on retry

**Week 2-3**: Evidence + Verification + Indexing operational
- ✅ Evidence linked to entities
- ✅ Confidence scores calculable
- ✅ Materialized views fast (sub-second)
- ✅ Search index rebuildable without stalling imports

**Week 4**: AutoTuner ingestion proven
- ✅ 767 records imported with 0 duplicates
- ✅ Confidence_score: 40 on all records
- ✅ Evidence_breakdown correct
- ✅ Source_id + retrieved_at 100% populated

**Week 5**: Reconciliation proven
- ✅ Cross-source entity matching > 95% accurate
- ✅ Conflicts detected and reported
- ✅ Evidence aggregation reduces data duplication
- ✅ Consensus method determinable for 90%+ of matches

**Week 6**: Admin workflow proven
- ✅ Conflicts manually resolvable via UI
- ✅ Bulk commit without data corruption
- ✅ Audit trail 100% complete
- ✅ Performance baseline established

---

## After Phase 0B.5: Path Forward

### Immediate (Phase 0C): Web Sources
- Add WebScraperConnector for vendor portals
- Implement source freshness tracking
- Build incremental sync strategy
- Add change detection + diff events

### Medium-term (Phase 0D): Advanced Features
- Scheduled source refresh (daily/weekly)
- Automatic conflict resolution heuristics
- Evidence weighting refinement
- Regional ECU specialization (GCC market)
- Firmware metadata enrichment

### Long-term (Phase 1+): Platform Intelligence
- Compatibility intelligence engine (not just data listing)
- Workshop validation network (confidence boosting)
- Regional tuning tool rankings
- Predictive method discovery
- Firmware update tracking

---

## Conclusion

This three-phase approach ensures:
1. **Rock-solid backend** before any frontend touches it
2. **Proven ingestion** on known datasets before risky web sources
3. **Auditable reconciliation** with manual controls, not auto-magic
4. **Scalable architecture** that handles multi-source complexity
5. **Data integrity** as the core platform value, not UI pizzazz

The moat is **backend intelligence** — compatibility knowledge, evidence provenance, source triangulation, conflict detection. Frontend is just the interface to that intelligence.

After Phase 0B.5, you'll have a **real compatibility intelligence engine**, not just a database UI.
