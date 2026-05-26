# Import Architecture: Staging, Validation, Conflict Resolution

## Overview

CaracalTech's import pipeline enforces data quality at every stage:
1. **Ingest**: CSV → staging table (raw data preserved)
2. **Validate**: Schema, foreign keys, duplicates, similarities
3. **Detect**: Conflicts and divergent data sources
4. **Review**: Admin workflow to resolve and merge
5. **Commit**: Batch transfer to production + reindex
6. **Audit**: Complete history tracking

This architecture prevents bad data from entering production while preserving source attribution.

---

## Stage 1: Ingest (CSV → Staging)

### Upload Flow

```
User uploads CSV
    ↓
Parse headers & rows
    ↓
Create import_batch record (status=pending)
    ↓
For each row:
  - Parse CSV values
  - Create import_staging record
  - Store raw_data (JSONB)
  - Set validation_status=pending
    ↓
Return batch_id to admin
```

### import_batch Record

```sql
INSERT INTO import_batches (
  id, source_id, batch_status, total_records, user_id, created_at
) VALUES (
  gen_random_uuid(),
  source_id,  -- e.g., KESS3 official, community_submission_123
  'pending',
  row_count,
  admin_user_id,
  now()
);
```

### import_staging Records (Per Row)

```sql
INSERT INTO import_staging (
  id, import_batch_id, table_name, raw_data, validation_status, sequence_number, created_at
) VALUES (
  gen_random_uuid(),
  batch_id,
  'vehicle_ecu_applications',  -- Determine from CSV column headers
  '{"vehicle_id": "...", "engine_id": "...", ...}',
  'pending',
  row_sequence,
  now()
);
```

### Raw Data Preservation

Raw CSV data ALWAYS stored in `raw_data` (JSONB). This enables:
- Admin review of original input
- Debugging import logic changes
- Dispute resolution ("I uploaded this 6 months ago")
- Audit trail linkage

---

## Stage 2: Validation

### Validation Phases

```
For each import_staging record (status=pending):
  
  Phase 1: Schema Validation
    ├─ Check required fields present
    ├─ Check field types (string, integer, uuid, enum, json)
    ├─ Check enum values in whitelist
    ├─ Check string length constraints
    ├─ Check integer range constraints
    └─ Store errors in validation_errors (JSON array)
  
  Phase 2: Reference Validation
    ├─ Foreign key references exist
    │  ├─ vehicle_id exists in vehicles table
    │  ├─ engine_id exists in engines table
    │  ├─ ecu_model_id exists in ecu_models table
    │  └─ source_id exists in sources table
    ├─ Reference matches vehicle-engine relationship
    └─ Store missing references in validation_errors
  
  Phase 3: Uniqueness & Duplication
    ├─ Exact duplicates in staging batch
    │  (same table_name + all field values identical)
    ├─ Exact duplicates in production (existing record)
    └─ Mark as conflict if found

  ↓
  If ANY errors: validation_status = invalid
  Else if conflicts detected: validation_status = conflict
  Else: validation_status = valid
```

### Schema Validation Rules

**Tables & Fields**:

| Table | Required Fields | Type | Constraint |
|-------|-----------------|------|-----------|
| vehicles | make, model, year_start, year_end, primary_market | string, string, int, int, enum | length 1-100, int > 0 |
| engines | vehicle_id, engine_code, displacement_cc, cylinders, fuel_type | uuid, string, int, int, enum | valid_uuid, length 1-50, int > 0 |
| ecu_models | ecu_family_id, model_code, memory_kb, processor | uuid, string, int, string | valid_uuid, unique, int > 0 |
| vehicle_ecu_applications | vehicle_id, engine_id, ecu_model_id, region | uuid, uuid, uuid, enum | valid_uuid, valid_enum |
| tool_ecu_methods | tool_id, ecu_model_id, method_type | uuid, uuid, enum | valid_uuid, valid_enum |

### Code Example: Schema Validation

```javascript
async function validateImportBatch(batchId) {
  const stagingRecords = await db('import_staging')
    .where({ import_batch_id: batchId, validation_status: 'pending' });

  const schemaMap = {
    vehicles: {
      make: { type: 'string', required: true, maxLength: 100 },
      model: { type: 'string', required: true, maxLength: 150 },
      year_start: { type: 'integer', required: true, min: 1900, max: 2100 },
      year_end: { type: 'integer', required: true, min: 1900, max: 2100 },
      primary_market: { type: 'enum', enum: ['EU', 'US', 'CN', 'GCC', 'RU', 'AU', 'JP'] },
      markets: { type: 'json', required: false },
    },
    vehicle_ecu_applications: {
      vehicle_id: { type: 'uuid', required: true, foreignKey: 'vehicles.id' },
      engine_id: { type: 'uuid', required: true, foreignKey: 'engines.id' },
      ecu_model_id: { type: 'uuid', required: true, foreignKey: 'ecu_models.id' },
      region: { type: 'enum', enum: ['EU', 'US', 'CN', 'GCC', 'RU', 'AU', 'JP'] },
      confidence_score: { type: 'integer', min: 0, max: 100 },
    },
    // ... more tables
  };

  for (const record of stagingRecords) {
    const schema = schemaMap[record.table_name];
    const errors = [];

    // Check each field
    for (const [fieldName, rules] of Object.entries(schema)) {
      const value = record.raw_data[fieldName];

      if (rules.required && (value === null || value === undefined)) {
        errors.push(`Missing required field: ${fieldName}`);
        continue;
      }

      if (value === null || value === undefined) {
        continue; // Optional field
      }

      // Type validation
      if (rules.type === 'integer' && typeof value !== 'number') {
        errors.push(`Field ${fieldName} must be integer, got ${typeof value}`);
      }
      if (rules.type === 'uuid' && !isValidUUID(value)) {
        errors.push(`Field ${fieldName} must be valid UUID`);
      }
      if (rules.type === 'enum' && !rules.enum.includes(value)) {
        errors.push(`Field ${fieldName} must be one of: ${rules.enum.join(', ')}`);
      }

      // Range validation
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`Field ${fieldName} must be >= ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`Field ${fieldName} must be <= ${rules.max}`);
      }

      // Length validation
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`Field ${fieldName} exceeds max length ${rules.maxLength}`);
      }

      // Foreign key validation (reference exists)
      if (rules.foreignKey) {
        const [refTable, refField] = rules.foreignKey.split('.');
        const exists = await db(refTable).where({ [refField]: value }).first();
        if (!exists) {
          errors.push(`Foreign key ${fieldName}=${value} does not exist in ${refTable}`);
        }
      }
    }

    // Update validation result
    let validationStatus = 'valid';
    if (errors.length > 0) {
      validationStatus = 'invalid';
    }

    await db('import_staging')
      .where({ id: record.id })
      .update({
        validation_status: validationStatus,
        validation_errors: JSON.stringify(errors),
      });
  }
}
```

---

## Stage 3: Conflict Detection

### Conflict Types

```
1. EXACT DUPLICATE
   └─ Same table_name + ALL fields identical in production
      └─ Action: Mark as conflict, confidence = 100
      
2. SIMILAR MATCH (Similarity Score Algorithm)
   ├─ Same vehicle (make + model + year_start/end)
   ├─ Same engine (displacement_cc + cylinders + fuel_type)
   ├─ Same ECU model (family + model_code)
   └─ Score = (matching_field_count / total_fields) * 100
      └─ If score >= 70: Mark as conflict, allow merge review
      
3. REFERENCE MISMATCH
   ├─ vehicle_id exists but engine_id doesn't match vehicle
   ├─ ecu_model_id exists but manufacturer mismatch
   └─ Action: Mark as conflict, flag for admin review
   
4. DATA DIVERGENCE
   ├─ Same vehicle-ecu pair, but confidence_score differs significantly (>20 points)
   ├─ Same part number, but hardware_version differs
   └─ Action: Mark as conflict, confidence = incoming_confidence + existing_confidence / 2
```

### Similarity Scoring Algorithm

```javascript
function calculateSimilarityScore(incoming, existing) {
  let matchingFields = 0;
  let totalFields = 0;

  const scoringRules = {
    vehicles: {
      make: { weight: 1.0, type: 'string', comparison: 'exact' },
      model: { weight: 1.0, type: 'string', comparison: 'exact' },
      year_start: { weight: 0.5, type: 'integer', comparison: 'exact' },
      year_end: { weight: 0.5, type: 'integer', comparison: 'exact' },
    },
    engines: {
      engine_code: { weight: 1.0, type: 'string', comparison: 'fuzzy' },
      displacement_cc: { weight: 0.8, type: 'integer', comparison: 'within_10_percent' },
      cylinders: { weight: 0.8, type: 'integer', comparison: 'exact' },
      fuel_type: { weight: 0.9, type: 'enum', comparison: 'exact' },
    },
    vehicle_ecu_applications: {
      vehicle_id: { weight: 1.0, type: 'uuid', comparison: 'exact' },
      ecu_model_id: { weight: 1.0, type: 'uuid', comparison: 'exact' },
      region: { weight: 0.7, type: 'enum', comparison: 'exact' },
    },
  };

  const rules = scoringRules[incoming.table_name];
  
  for (const [field, rule] of Object.entries(rules)) {
    totalFields += rule.weight;
    const incomingVal = incoming[field];
    const existingVal = existing[field];

    let isMatch = false;
    if (rule.comparison === 'exact') {
      isMatch = incomingVal === existingVal;
    } else if (rule.comparison === 'fuzzy') {
      // Levenshtein distance < 3
      isMatch = levenshteinDistance(incomingVal, existingVal) < 3;
    } else if (rule.comparison === 'within_10_percent') {
      const diff = Math.abs(incomingVal - existingVal);
      const percentDiff = (diff / existingVal) * 100;
      isMatch = percentDiff <= 10;
    }

    if (isMatch) {
      matchingFields += rule.weight;
    }
  }

  return Math.round((matchingFields / totalFields) * 100);
}
```

### Conflict Detection Flow

```javascript
async function detectConflicts(batchId) {
  const stagingRecords = await db('import_staging')
    .where({ import_batch_id: batchId, validation_status: 'valid' });

  for (const record of stagingRecords) {
    const { table_name, raw_data } = record;

    // Check for exact duplicate in production
    let existingRecord = await db(table_name).where(raw_data).first();
    
    if (existingRecord) {
      // Exact duplicate
      await db('import_staging')
        .where({ id: record.id })
        .update({
          validation_status: 'conflict',
          conflict_type: 'duplicate',
          existing_record_id: existingRecord.id,
          similarity_score: 100,
        });

      await db('import_conflicts').insert({
        id: knex.raw('gen_random_uuid()'),
        import_staging_id: record.id,
        existing_record_id: existingRecord.id,
        conflict_type: 'duplicate',
        confidence_match: 100,
        incoming_data: raw_data,
        existing_data: existingRecord,
        resolution_status: 'unresolved',
      });

      continue;
    }

    // Check for similar matches
    const similarities = await findSimilarRecords(table_name, raw_data);
    
    for (const similarity of similarities) {
      if (similarity.score >= 70) {
        // Create conflict record
        await db('import_staging')
          .where({ id: record.id })
          .update({
            validation_status: 'conflict',
            conflict_type: 'similar',
            existing_record_id: similarity.id,
            similarity_score: similarity.score,
          });

        await db('import_conflicts').insert({
          id: knex.raw('gen_random_uuid()'),
          import_staging_id: record.id,
          existing_record_id: similarity.id,
          conflict_type: 'similar',
          confidence_match: similarity.score,
          incoming_data: raw_data,
          existing_data: similarity.data,
          resolution_status: 'unresolved',
        });

        break; // One conflict per incoming record
      }
    }
  }

  // Update batch status
  const counts = await db('import_staging')
    .where({ import_batch_id: batchId })
    .select(
      db.raw("COUNT(CASE WHEN validation_status = 'valid' THEN 1 END) as valid_records"),
      db.raw("COUNT(CASE WHEN validation_status = 'invalid' THEN 1 END) as invalid_records"),
      db.raw("COUNT(CASE WHEN validation_status = 'conflict' THEN 1 END) as conflict_records")
    )
    .first();

  await db('import_batches')
    .where({ id: batchId })
    .update({
      batch_status: 'conflicted',
      valid_records: counts.valid_records,
      invalid_records: counts.invalid_records,
      conflict_records: counts.conflict_records,
      validated_at: db.fn.now(),
    });
}
```

---

## Stage 4: Admin Review & Conflict Resolution

### Admin Workflow Interface

Admin views batch in three sections:

1. **Invalid Records** (validation_status=invalid)
   - Cannot proceed without fixing
   - Show validation_errors details
   - Options: Edit raw data and re-validate, or Delete from batch

2. **Conflicting Records** (validation_status=conflict)
   - Show side-by-side comparison (incoming vs. existing)
   - Similarity score displayed
   - Options:
     - ✓ Merge (merge fields, use higher confidence)
     - ✓ Keep existing (discard incoming)
     - ✓ Use incoming (replace existing)
     - ✓ Manual review (flag for later)

3. **Valid Records** (validation_status=valid)
   - Ready to commit
   - Show summary statistics
   - Option to proceed to commit

### Conflict Resolution Strategies

```javascript
async function resolveConflict(conflictId, resolutionStrategy, adminNotes) {
  const conflict = await db('import_conflicts')
    .where({ id: conflictId })
    .first();

  let resolvedData;

  switch (resolutionStrategy) {
    case 'merge':
      // Merge field by field, taking incoming unless it's null/undefined
      resolvedData = { ...conflict.existing_data };
      for (const [key, value] of Object.entries(conflict.incoming_data)) {
        if (value !== null && value !== undefined) {
          resolvedData[key] = value;
        }
      }
      // Confidence = average of both
      resolvedData.confidence_score = Math.round(
        (conflict.incoming_data.confidence_score + conflict.existing_data.confidence_score) / 2
      );
      break;

    case 'keep_existing':
      // No change, just mark as resolved
      resolvedData = conflict.existing_data;
      break;

    case 'use_incoming':
      // Replace with incoming data
      resolvedData = conflict.incoming_data;
      break;

    case 'manual_review':
      // Flag for later human review
      await db('import_conflicts')
        .where({ id: conflictId })
        .update({
          resolution_status: 'manual_review',
          resolved_at: db.fn.now(),
        });
      return;
  }

  // Update conflict record
  await db('import_conflicts')
    .where({ id: conflictId })
    .update({
      resolution_status: resolutionStrategy,
      resolved_by_user_id: adminUserId,
      resolution_notes: adminNotes,
      resolved_at: db.fn.now(),
    });

  // Update staging record to valid (after resolution)
  await db('import_staging')
    .where({ id: conflict.import_staging_id })
    .update({
      validation_status: 'valid',
      conflict_data: null,
    });
}
```

---

## Stage 5: Commit (Transfer to Production)

### Pre-Commit Validation

```
Before committing batch:
  ✓ All invalid records resolved or deleted
  ✓ All conflicts resolved
  ✓ All valid records have confidence_score
  ✓ All records have source_id
  ✓ No broken foreign key references
  ✓ Audit log ready to write
```

### Commit Flow

```sql
BEGIN TRANSACTION;

-- 1. For each valid staging record
--    Insert into production table
INSERT INTO vehicle_ecu_applications (
  id, vehicle_id, engine_id, ecu_model_id, region, 
  confidence_score, verified_by_admin, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  raw_data->>'vehicle_id',
  raw_data->>'engine_id',
  raw_data->>'ecu_model_id',
  raw_data->>'region',
  COALESCE((raw_data->>'confidence_score')::int, 50),
  false,
  now(),
  now()
FROM import_staging
WHERE import_batch_id = $1 AND validation_status = 'valid' AND table_name = 'vehicle_ecu_applications'
RETURNING id, vehicle_id;

-- 2. For each inserted record, create record_sources entry
INSERT INTO record_sources (
  id, record_type, record_id, source_id, confidence_score, 
  verified_by_admin, retrieved_at, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'vehicle_ecu_application',
  new_records.id,
  $2,  -- source_id from batch
  COALESCE((s.raw_data->>'confidence_score')::int, 50),
  false,
  now(),
  now(),
  now()
FROM new_records
JOIN import_staging s ON new_records.id = ... ;

-- 3. Create audit log entries
INSERT INTO audit_logs (
  id, action, user_id, table_name, record_id, new_data, change_reason, created_at, updated_at
) VALUES (...);

-- 4. Mark batch as committed
UPDATE import_batches
SET batch_status = 'committed', committed_at = now()
WHERE id = $1;

COMMIT;

-- 5. Reindex Typesense (after transaction commits)
-- POST /typesense/collections/ecus/documents/import
```

### Code Example: Commit Function

```javascript
async function commitImportBatch(batchId, adminUserId) {
  const batch = await db('import_batches').where({ id: batchId }).first();
  
  if (batch.batch_status !== 'conflicted') {
    throw new Error('Batch must be fully validated and conflicts resolved');
  }

  const stagingRecords = await db('import_staging')
    .where({ import_batch_id: batchId, validation_status: 'valid' });

  if (stagingRecords.length === 0) {
    throw new Error('No valid records to commit');
  }

  const trx = await db.transaction();

  try {
    // Group by table name
    const byTable = {};
    for (const record of stagingRecords) {
      if (!byTable[record.table_name]) {
        byTable[record.table_name] = [];
      }
      byTable[record.table_name].push(record);
    }

    // Insert each table
    const insertedIds = {};
    for (const [tableName, records] of Object.entries(byTable)) {
      const inserted = await trx(tableName).insert(
        records.map(r => ({
          id: knex.raw('gen_random_uuid()'),
          ...r.raw_data,
          created_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        }))
      ).returning('id');

      insertedIds[tableName] = inserted;
    }

    // Create record_sources for each inserted record
    for (const [tableName, ids] of Object.entries(insertedIds)) {
      const recordType = tableNameToRecordType(tableName); // Convert singular/plural
      await trx('record_sources').insert(
        ids.map(id => ({
          id: knex.raw('gen_random_uuid()'),
          record_type: recordType,
          record_id: id,
          source_id: batch.source_id,
          confidence_score: 50, // Default, can be overridden per record
          verified_by_admin: false,
          retrieved_at: trx.fn.now(),
          created_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        }))
      );
    }

    // Create audit logs
    for (const [tableName, ids] of Object.entries(insertedIds)) {
      await trx('audit_logs').insert(
        ids.map(id => ({
          id: knex.raw('gen_random_uuid()'),
          action: 'created',
          user_id: adminUserId,
          table_name: tableName,
          record_id: id,
          new_data: trx.raw('?', stagingRecords.find(r => r.table_name === tableName).raw_data),
          change_reason: `Imported from batch ${batchId}`,
          created_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        }))
      );
    }

    // Update batch status
    await trx('import_batches')
      .where({ id: batchId })
      .update({
        batch_status: 'committed',
        committed_at: trx.fn.now(),
      });

    await trx.commit();

    // AFTER transaction, reindex Typesense
    await reindexTypesense(insertedIds);

    return {
      status: 'committed',
      recordsInserted: stagingRecords.length,
      timestamp: new Date(),
    };
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}
```

---

## Stage 6: Typesense Reindexing

### Reindex After Commit

```javascript
async function reindexTypesense(insertedIdsByTable) {
  const typesenseConfig = {
    nodes: [{ host: process.env.TYPESENSE_HOST, port: process.env.TYPESENSE_PORT }],
    apiKey: process.env.TYPESENSE_API_KEY,
  };

  const typesense = new TypesenseClient(typesenseConfig);

  // Fetch fresh data and build search documents
  const searchDocuments = [];

  // Index vehicles
  const vehicles = await db('vehicles').whereIn('id', insertedIdsByTable.vehicles || []);
  for (const vehicle of vehicles) {
    searchDocuments.push({
      id: vehicle.id,
      type: 'vehicle',
      make: vehicle.make,
      model: vehicle.model,
      year_start: vehicle.year_start,
      year_end: vehicle.year_end,
      primary_market: vehicle.primary_market,
      display_name: `${vehicle.make} ${vehicle.model} (${vehicle.year_start}-${vehicle.year_end})`,
    });
  }

  // Index ECU models
  const ecuModels = await db('ecu_models').whereIn('id', insertedIdsByTable.ecu_models || []);
  for (const model of ecuModels) {
    const family = await db('ecu_families').where({ id: model.ecu_family_id }).first();
    searchDocuments.push({
      id: model.id,
      type: 'ecu_model',
      family: family.family_name,
      model_code: model.model_code,
      display_name: `${family.family_name} ${model.model_designation}`,
    });
  }

  // ... more document types

  // Bulk import into Typesense
  if (searchDocuments.length > 0) {
    const collectionName = 'ecus_search'; // Main collection
    await typesense.collections(collectionName).documents().import(searchDocuments);
  }
}
```

---

## Confidence Scoring System

### Confidence Calculation

```javascript
function calculateConfidenceScore(record, source, evidenceList) {
  let score = 0;

  // 1. Source credibility (0-40 points)
  score += (source.credibility_score / 100) * 40;

  // 2. Evidence type weights (0-35 points)
  const evidenceWeights = {
    official_doc: 35,
    workshop_verified: 30,
    bench_test: 28,
    firmware_analysis: 25,
    successful_read: 20,
    successful_write: 20,
    community_report: 12,
  };

  if (evidenceList && evidenceList.length > 0) {
    const avgWeight = evidenceList.reduce((sum, e) => sum + evidenceWeights[e.type], 0) / evidenceList.length;
    score += avgWeight;
  }

  // 3. Verification count (0-15 points)
  const verificationCount = evidenceList ? evidenceList.length : 0;
  score += Math.min(verificationCount * 5, 15);

  // 4. Admin verification bonus (+10 points)
  if (record.verified_by_admin) {
    score += 10;
  }

  // 5. Conflict resolution (adjust based on merge type)
  if (record.conflict_resolution === 'merge') {
    score = Math.min(score, 75); // Merged records max out at 75
  }

  return Math.min(Math.round(score), 100);
}
```

### Confidence Tiers

| Tier | Score | Meaning | Action |
|------|-------|---------|--------|
| Official | 90-100 | Multiple official sources, benchmark-verified | Show prominently |
| Verified | 70-89 | Community consensus + official, workshop confirmed | Show with confidence badge |
| Probable | 50-69 | Single unverified source or single community | Show with caution |
| Reported | 30-49 | User-reported, conflicting sources | Show warning |
| Unverified | 0-29 | Deprecated or deprecated data | Show as historical only |

---

## CSV Template Examples

### vehicles.csv

```csv
make,model,year_start,year_end,primary_market,markets,vin_pattern,notes
Mercedes-Benz,E-Class,2016,2020,EU,"EU,GCC",WDB2,E-Class W213 platform
BMW,3-Series,2017,2021,EU,"EU,US",WBADT,F30/F31 generation
Audi,A4,2015,2019,EU,"EU,GCC",WAUXY,B9 generation
```

### engines.csv

```csv
vehicle_id,engine_code,engine_name,displacement_cc,cylinders,horsepower_stock,torque_stock_nm,fuel_type,aspiration
<vehicle_uuid>,M256E30,2.0L Turbo,1991,4,258,370,petrol,turbocharged
<vehicle_uuid>,OM654A,2.0L Diesel,1950,4,163,380,diesel,turbocharged
```

### vehicle_ecu_applications.csv

```csv
vehicle_id,engine_id,ecu_model_id,region,production_year_start,production_year_end,protocol_primary,confidence_score,verified_by_admin,notes
<vehicle_uuid>,<engine_uuid>,<ecu_model_uuid>,EU,2016,2020,OBD2,85,true,E-Class W213 EU model
<vehicle_uuid>,<engine_uuid>,<ecu_model_uuid>,GCC,2016,2020,OBD2,75,false,GCC variant slightly different emissions
```

### tool_ecu_methods.csv

```csv
tool_id,ecu_model_id,method_type,support_status,unlock_required,plugin_required,protocol,read_speed_kb_sec,write_speed_kb_sec,supports_read,supports_write,supports_erase,confidence_score,verified_by_admin
<tool_uuid>,<ecu_uuid>,obd2,full,false,false,KWP2000,512,256,true,true,false,90,true
<tool_uuid>,<ecu_uuid>,bench,partial,true,true,OBD2,1024,512,true,true,true,75,true
<tool_uuid>,<ecu_uuid>,boot,unsupported,false,false,,,false,false,false,20,false
```

---

## Dry-Run Mode

Before committing, admins can preview results without changing data:

```javascript
async function dryRunCommit(batchId) {
  const stagingRecords = await db('import_staging')
    .where({ import_batch_id: batchId, validation_status: 'valid' });

  const preview = {
    total_records: stagingRecords.length,
    by_table: {},
    by_market: {},
    confidence_distribution: {},
  };

  for (const record of stagingRecords) {
    if (!preview.by_table[record.table_name]) {
      preview.by_table[record.table_name] = 0;
    }
    preview.by_table[record.table_name]++;

    const confidence = record.raw_data.confidence_score || 50;
    const tier = confidenceTier(confidence);
    if (!preview.confidence_distribution[tier]) {
      preview.confidence_distribution[tier] = 0;
    }
    preview.confidence_distribution[tier]++;

    if (record.table_name === 'vehicle_ecu_applications') {
      const market = record.raw_data.region;
      if (!preview.by_market[market]) {
        preview.by_market[market] = 0;
      }
      preview.by_market[market]++;
    }
  }

  return preview;
}
```

---

## Error Handling & Rollback

All errors during import are caught and logged:

```javascript
async function safeImportBatch(batchId, adminUserId) {
  try {
    // Validation phase
    await validateImportBatch(batchId);

    // Conflict detection phase
    await detectConflicts(batchId);

    // Dry-run preview
    const preview = await dryRunCommit(batchId);
    console.log('Dry run preview:', preview);

    // Actual commit
    await commitImportBatch(batchId, adminUserId);

    return { status: 'success', batchId };
  } catch (error) {
    // Log error
    await db('import_batches')
      .where({ id: batchId })
      .update({
        batch_status: 'failed',
        validation_summary: error.message,
      });

    // Don't modify production data if error occurs
    throw error;
  }
}
```

---

## Summary

The import architecture prioritizes:
- **Data Quality**: Multi-phase validation before production insert
- **Source Attribution**: Every record linked to source with confidence
- **Conflict Resolution**: Admin workflow for divergent data
- **Auditability**: Complete change history
- **Safety**: Dry-run, transactions, rollback capability
- **Transparency**: Confidence scores and evidence tracking
