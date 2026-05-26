# Dataset Ingestion & Normalization Framework

## Executive Summary

Four complementary datasets available for ingestion:
- **Autotuner** (767 deduplicated rows): ECU/MCU compatibility, NO vehicle applications
- **PCMtuner** (7,076 rows): Vehicle applications with years, power, fuel, connection modes
- **DFB** (6,128 rows): Tool-specific driver compatibility (read/write modes)
- **Multi-PROG** (20,211 rows): Chip/component database (not vehicle applications)

**Critical Insight:** No single dataset is complete. PCMtuner + DFB is the core vehicle compatibility foundation. Autotuner + Multi-PROG provide component/MCU validation layers.

---

## Dataset Analysis

### 1. Autotuner PDF Export (767 deduplicated rows)

**Source:** Auto tuner .pdf (97 pages)

**Strengths:**
- 1,146 Bosch ECUs identified
- 280 Continental ECUs
- Clean ECU model names (ME17.3.0, ME7.9.10, etc.)
- Deduplicated (2,066 raw → 767 unique)

**Weaknesses:**
- **NO manufacturer** (null): Can't link to vehicles
- **NO model** (null): Can't identify which car uses this ECU
- **NO year** (null): Regional/market variants unknown
- **NO methods** (omitted): Can't track read/write/boot/obd capability
- Vehicle type only (Car, Agri, Moto, Trucks)

**Data Quality:** Medium. Useful for ECU master reference but unusable alone for vehicle compatibility.

**Canonical Mapping:**
```
AutoTuner row → ecu_models table
- ecu_brand → manufacturers (Bosch, Continental, etc.)
- ecu_model → model_code (ME17.3.0)
- mcu → part_number (TC1724, ST10F275)
- confidence_score → 40 (no vehicle validation)
- confidence_breakdown.source_weight → 0.5 (unverified ECU reference)
```

---

### 2. PCMtuner PDF (7,076 rows)

**Source:** pcmtuner-detail-car-ecu-list.pdf

**Strengths:**
- **160 unique vehicle brands** (Abarth, BMW, Mercedes, etc.)
- **7,076 vehicle applications** with full context
- **Year ranges** (2008-2017, etc.)
- **Power/fuel data** (170 PS Petrol, etc.)
- **Connection modes** guessed (BOOT, OBD, BENCH)
- **MCU hierarchy** (TC1724 ME17.3.0 shows MCU→ECU relationship)
- **3,786 rows have year data**
- **6,781 car rows** (plus trucks, agri, etc.)

**Weaknesses:**
- **Guessed data**: ecu_maker_guess, fuel_guess, power_guess (not authoritative)
- **Parsed from PDF**: OCR errors possible
- **No read/write capability** information (just connection mode)
- **No evidence source**: Is this OEM data or workshop data?
- **Year as range**: "2008-2017" not specific model year

**Data Quality:** High for vehicle/ECU structure, medium for technical details (guessed).

**Canonical Mapping:**
```
PCMtuner row → vehicle_ecu_applications table
- brand → vehicles.make
- model → vehicles.model
- year → vehicles.year_start/year_end (parse range)
- fuel_guess → engines.fuel_type
- power_ps_guess → engines.horsepower
- ecu_maker_guess → ecu_models.manufacturer
- ecu_model_guess → ecu_models.model_code
- connection_mode_guess → tool_ecu_methods.method_type (map BOOT→JTAG, OBD→OBD, BENCH→BENCH)
- confidence_score → 65 (guessed, but vehicle-validated)
- confidence_breakdown.source_weight → 0.6 (guessed but structured)
- confidence_breakdown.vehicle_validation_weight → 0.5 (has year/make/model proof)
- confidence_breakdown.guess_penalty → -0.15 (ecu_maker_guess, fuel_guess)
```

---

### 3. DFB Driver List PDF (6,128 rows)

**Source:** DRIVER_LIST_DFOX_DFB.pdf (100 pages, 07/2022)

**Strengths:**
- **Tool-specific driver compatibility** (DFB = tuning tool)
- **Read/Write status** (VR/W = can read and write)
- **Explicit modes**: OBD, BOOT, BENCH, JTAG, CAN, etc.
- **263 vehicle brands** (comprehensive)
- **6,128 application rows**
- **Engine type** (1.4l TJet 16V = disambiguates variants)
- **MCU details** (MPC5553/5565 EEPROM 95640)
- **198 partially unparsed** (known quality issues)

**Weaknesses:**
- **NO year** (mostly null): Can't determine market/generation
- **NO power/fuel**: Less precise than PCMtuner
- **Only for DFB tool**: Limited to this tool's compatibility
- **No OEM source**: Workshop data, not official
- **Parser quality**: 198 unparsed rows suggest PDF is messy
- **2022 vintage**: May be outdated (over 3 years old)

**Data Quality:** High for tool-specific read/write modes, low for year/regional variants.

**Canonical Mapping:**
```
DFB row → tool_ecu_methods table
- ecu_brand → ecu_models.manufacturer
- ecu_type → ecu_models.model_code
- modes (OBD, BOOT, BENCH, JTAG) → method_type
- rw_vr_status → supportsRead, supportsWrite boolean
- confidence_score → 70 (tool-verified, no year/regional context)
- confidence_breakdown.source_weight → 0.8 (tool provider is authoritative)
- confidence_breakdown.verification_weight → 0.7 (DFB driver = live testing)
- confidence_breakdown.temporal_penalty → -0.1 (2022 vintage, over 3 years old)
```

---

### 4. Multi-PROG Chip List (20,211 rows)

**Source:** Multi-PROG_Chips.xlsx (552 manufacturers)

**Strengths:**
- **Comprehensive chip database**: 20,211 devices
- **12,552 MCU entries** (microcontrollers)
- **4,359 ECU entries**
- **Standard manufacturer names** (Altera, ST, NXP, etc.)
- **Organized by type** (Serial EEPROM, FLASH, MCU, ECU, etc.)

**Weaknesses:**
- **NOT a vehicle database**: Chip-focused, not application-focused
- **NO vehicle brand** (null)
- **NO vehicle model** (null)
- **NO vehicle year** (null)
- Useful for chip reference but doesn't validate vehicle compatibility
- MCU/ECU mapping incomplete (which ECU uses which MCU?)

**Data Quality:** High for chip specifications, unusable for vehicle compatibility without cross-reference.

**Canonical Mapping:**
```
Multi-PROG row → ecu_models table (MCU part numbers only)
- type (ECU) → maps to ECU-level records
- manufacturer → manufacturers
- series → part_family
- name → part_number
- confidence_score → 50 (chip reference only, no application context)
- confidence_breakdown.source_weight → 0.4 (unverified chip reference)
- use_case → "MCU/Chip reference validation" (not primary data)
```

---

## Ingestion Pipeline Architecture

### Phase 1: Raw Import (No Transformation)

**Directory Structure:**
```
/datasets/
├── raw/                          # Original files (unchanged)
│   ├── autotuner_compatibility_full.json
│   ├── pcmtuner_full_vehicle_database.json
│   ├── dfb_driver_list_full.json
│   ├── multiprog_chip_list_full.json
│   └── source_metadata.json
│
├── normalized/                   # Canonical format (intermediate)
│   ├── autotuner_normalized.json
│   ├── pcmtuner_normalized.json
│   ├── dfb_normalized.json
│   └── multiprog_normalized.json
│
├── staging/                      # Ready for import (conflicts resolved)
│   ├── vehicles_staging.json
│   ├── ecu_models_staging.json
│   ├── ecu_part_numbers_staging.json
│   ├── vehicle_ecu_applications_staging.json
│   ├── tool_ecu_methods_staging.json
│   └── conflicts.json
│
├── rejected/                     # Records that failed validation
│   ├── validation_errors.json
│   ├── duplicate_fingerprints.json
│   └── unresolved_conflicts.json
│
└── metadata/
    ├── import_stats.json
    ├── schema_mapping.json
    ├── normalization_rules.json
    └── source_attribution.json
```

### Phase 2: Normalization (Transform to Canonical Schema)

**Normalization Rules Engine** - `src/utils/datasetNormalization.js`

1. **ECU Naming Normalization**
   ```javascript
   // Input variations → canonical
   "ME17.3.0" → "ME17.3.0"
   "ME 17.3.0" → "ME17.3.0"
   "ME-17.3.0" → "ME17.3.0"
   "Bosch ME17.3.0" → "ME17.3.0" (strip manufacturer prefix)
   "TC1724 ME17.3.0" → {mcu: "TC1724", ecu_model: "ME17.3.0"}
   ```

2. **Manufacturer Normalization**
   ```javascript
   "Bosch" → "Bosch"
   "BOSCH" → "Bosch"
   "bosch" → "Bosch"
   "Bosch Motorsport" → "Bosch"
   "Continental Automotive" → "Continental"
   ```

3. **Vehicle Brand Normalization**
   ```javascript
   "BMW" → "BMW"
   "Mercedes-Benz" → "Mercedes-Benz"
   "Mercedes" → "Mercedes-Benz" (alias expansion)
   "VW" → "Volkswagen" (alias expansion)
   "Abarth" → "Abarth" (Fiat subsidiary, keep separate)
   ```

4. **Model Variant Normalization**
   ```javascript
   "124 Spider" → "124 Spider"
   "500" → "500"
   "(312)" → version code, store separately
   "Grande Punto" → "Punto" (normalize variants)
   "BMW 3-Series" → "3 Series" (consistency)
   ```

5. **Year/Market Normalization**
   ```javascript
   "2008-2017" → {year_start: 2008, year_end: 2017}
   "2016+" → {year_start: 2016, year_end: 2025}
   "2018 MY" → {year_start: 2018, year_end: 2018}
   null → {year_start: null, year_end: null}
   ```

6. **Method Type Normalization**
   ```javascript
   "OBD" → OBD
   "BOOT" → JTAG (rename, same hardware protocol)
   "BENCH" → BENCH (standalone programming)
   "JTAG" → JTAG
   "CAN" → CAN
   "K-LINE" → KWP2000
   "OBD, BOOT" → [OBD, JTAG] (split and map)
   "VR/W" → {supportsRead: true, supportsWrite: true}
   ```

7. **Fuel Type Normalization**
   ```javascript
   "Petrol" → "petrol"
   "benzine" → "petrol"
   "essence" → "petrol"
   "Diesel" → "diesel"
   "TDI" → "diesel"
   "Hybrid" → "hybrid"
   null → null
   ```

---

### Phase 3: Deduplication & Conflict Detection

**Semantic Fingerprinting** - `src/utils/semanticFingerprinting.js`

For each dataset, compute:

1. **ECU Fingerprint**
   ```
   Bosch ME17.3.0 + MCU:TC1724
   → normalize → hash
   → fingerprint: "bosch_me173.0_tc1724"
   ```

2. **Vehicle Application Fingerprint**
   ```
   Mercedes-Benz E-Class 2016 + ME17.3.0 + OBD
   → normalize brand/model/year/ecu
   → hash
   → fingerprint: "mercedes_benz_e_class_2016_me173.0_obd"
   ```

3. **Cross-Dataset Conflict Detection**
   ```
   PCMtuner: Abarth 500 2008-2018 ME17.3.0 BOOT
   DFB: Abarth 500 1.4l TJet 16V ME7.9.10 OBD/BOOT
   
   Fingerprints differ (different ECU/method), but
   both reference Abarth 500 + tuning capability
   → Mark as "same_vehicle_different_ecu_variants"
   → Confidence: low on which is correct
   → Require admin resolution or evidence
   ```

---

### Phase 4: Source Attribution & Confidence Defaults

**Source Types & Confidence Defaults**

```
Autotuner (ECU reference only):
  - source_type: "ECU_REFERENCE"
  - source_credibility: 0.5
  - default_raw_confidence: 40
  - confidence_breakdown:
      source_weight: 0.5 (unverified reference)
      application_weight: 0 (no application data)
      verification_weight: 0
      
PCMtuner (Vehicle applications, guessed details):
  - source_type: "VEHICLE_APPLICATION"
  - source_credibility: 0.65
  - default_raw_confidence: 65
  - confidence_breakdown:
      source_weight: 0.6 (structured but guessed)
      vehicle_validation_weight: 0.5 (year/make/model proof)
      ecu_validation_weight: 0.3 (guessed ecu_maker)
      guess_penalty: -0.15
      
DFB (Tool-verified methods):
  - source_type: "TOOL_VERIFIED"
  - source_credibility: 0.70
  - default_raw_confidence: 70
  - confidence_breakdown:
      source_weight: 0.8 (tool provider authority)
      verification_weight: 0.7 (driver tested)
      temporal_penalty: -0.1 (2022 vintage)
      
Multi-PROG (Chip reference):
  - source_type: "CHIP_REFERENCE"
  - source_credibility: 0.4
  - default_raw_confidence: 40
  - confidence_breakdown:
      source_weight: 0.4 (chip reference only)
      application_weight: 0 (not vehicle data)
```

---

### Phase 5: Import Workflow

**Step 1: Raw Import**
```javascript
// For each dataset file:
const rawData = JSON.parse(fs.readFileSync('raw/autotuner_compatibility_full.json'))
// Store as-is in datasets/raw
// Compute file_hash: SHA256(rawData)
// Record in import metadata: source, file_hash, timestamp, row_count
```

**Step 2: Normalize**
```javascript
const normalized = rawData.rows.map(row => {
  // Apply normalization rules
  const canonical = {
    ecu_brand: normalizeManufacturer(row.ecu_brand),
    ecu_model: normalizeECUModel(row.ecu_model),
    mcu: normalizeMCU(row.mcu),
    manufacturer: normalizeManufacturer(row.manufacturer),
    model: normalizeModel(row.model),
    year_start: parseYear(row.year),
    // ... apply all rules
  }
  
  // Compute semantic fingerprint
  canonical.semantic_fingerprint = 
    semanticFingerprint(canonical, 'ecu')
  
  return canonical
})

// Save normalized output
fs.writeFileSync('normalized/autotuner_normalized.json', 
  JSON.stringify(normalized, null, 2))
```

**Step 3: Deduplicate Within Dataset**
```javascript
// Remove exact duplicates (same semantic fingerprint)
const deduplicated = [
  ...new Map(
    normalized.map(row => 
      [row.semantic_fingerprint, row]
    )
  ).values()
]

// Track: original_count, deduplicated_count
console.log(`Deduplicated: ${normalized.length} → ${deduplicated.length}`)
```

**Step 4: Merge & Cross-Deduplicate**
```javascript
// Merge normalized datasets
const all = [
  ...normalizedAutoTuner,
  ...normalizedPCMtuner,
  ...normalizedDFB,
  ...normalizedMultiProg
]

// Cross-dataset deduplication
const fingerprints = new Map()
const conflicts = []

all.forEach(record => {
  if (fingerprints.has(record.semantic_fingerprint)) {
    // Same fingerprint = potential duplicate
    const existing = fingerprints.get(record.semantic_fingerprint)
    if (isSameSource(existing, record)) {
      // Duplicate within same source: discard
      return
    } else {
      // Cross-dataset conflict: flag for review
      conflicts.push({
        fingerprint: record.semantic_fingerprint,
        existing: existing,
        incoming: record,
        conflict_type: 'cross_dataset_duplicate'
      })
    }
  }
  fingerprints.set(record.semantic_fingerprint, record)
})

// Save conflicts for admin review
fs.writeFileSync('staging/conflicts.json', JSON.stringify(conflicts, null, 2))
```

**Step 5: Validate Against Schema**
```javascript
// For each record, validate canonical format
const validationErrors = []

deduplicated.forEach((record, index) => {
  const errors = validateRecord(record)
  if (errors.length > 0) {
    validationErrors.push({
      record_index: index,
      record: record,
      errors: errors
    })
  }
})

if (validationErrors.length > 0) {
  fs.writeFileSync('rejected/validation_errors.json', 
    JSON.stringify(validationErrors, null, 2))
}

const validRecords = deduplicated.filter(r => 
  !validationErrors.find(e => e.record === r)
)
```

**Step 6: Assign Source Attribution & Confidence**
```javascript
// For each valid record, add source/confidence metadata
const withSource = validRecords.map(record => {
  const sourceType = detectSourceType(record)
  const confidenceDefaults = getConfidenceDefaults(sourceType)
  
  return {
    ...record,
    source_id: getSourceId(sourceType), // UUID from sources table
    source_type: sourceType,
    raw_confidence: confidenceDefaults.raw_confidence,
    calculated_confidence: null, // Will be computed on commit
    confidence_breakdown: confidenceDefaults.confidence_breakdown,
    retrieved_at: new Date().toISOString(),
    import_batch_id: batchId,
    needs_review: detectNeedsReview(record) // Flag ambiguous records
  }
})
```

**Step 7: Generate Import Staging**
```javascript
// Organize by target table
const staging = {
  vehicles: [],
  ecu_models: [],
  ecu_part_numbers: [],
  vehicle_ecu_applications: [],
  tool_ecu_methods: []
}

withSource.forEach(record => {
  // Route to appropriate table(s)
  if (record.vehicle_type && record.model) {
    staging.vehicles.push({
      id: uuid(),
      make: record.manufacturer,
      model: record.model,
      year_start: record.year_start,
      year_end: record.year_end,
      primary_market: detectMarket(record),
      source_id: record.source_id,
      raw_confidence: record.raw_confidence,
      retrieved_at: record.retrieved_at
    })
  }
  
  // Similar for other tables...
})

// Save staging records
Object.entries(staging).forEach(([table, records]) => {
  fs.writeFileSync(`staging/${table}_staging.json`, 
    JSON.stringify(records, null, 2))
})
```

---

## Import Order & Strategy

### Recommended Import Sequence

**Step 1: PCMtuner First** (7,076 vehicle applications)
- Reason: Most complete vehicle data (brand, model, year, power, fuel)
- Establishes vehicle base records
- Confidence: 65 (guessed but structured)
- Target tables: vehicles, engines, vehicle_ecu_applications

**Step 2: DFB Cross-Reference** (6,128 tool-verified methods)
- Reason: Validates/enhances PCMtuner ECU methods with read/write status
- Adds evidence: tool tested this ECU method
- Deduplicates against PCMtuner (same vehicle/ECU combos)
- Confidence: 70 (tool-verified)
- Target tables: tool_ecu_methods, vehicle_ecu_applications (enhance)

**Step 3: Autotuner Reference** (767 ECU specs)
- Reason: Validates MCU/ECU hierarchy
- Provides MCU part numbers for vehicles
- Lower confidence (40): unverified reference
- Deduplicates against PCMtuner ECU models
- Target tables: ecu_models, ecu_part_numbers

**Step 4: Multi-PROG Chip Validation** (20,211 chips)
- Reason: Validates MCU part numbers from Autotuner
- Confirms chip specifications
- Lowest confidence (40): chip reference only
- Deduplicates against Autotuner MCUs
- Target tables: ecu_part_numbers (reference validation)

---

## Deduplication Strategy

### Within-Dataset Deduplication

**Autotuner:**
- Already deduplicated 2,066 → 767 (provided in source)
- On import: fingerprint remaining 767

**PCMtuner:**
- 7,076 raw → deduplicate by vehicle/ECU/year combination
- Expected reduction: ~10-15% (variant duplicates)
- Result: ~6,000 unique vehicle applications

**DFB:**
- 6,128 raw → deduplicate by vehicle/ECU/method combination
- Accounting for: 198 unparsed (drop), ~5% quality issues
- Result: ~5,800 clean records

**Multi-PROG:**
- 20,211 raw → deduplicate by chip part number
- Result: keep all 20,211 (chips don't have variants)

### Cross-Dataset Deduplication

**PCMtuner ↔ DFB:**
- Same vehicle/ECU: may have different methods
- DFB adds read/write confirmation to PCMtuner ECUs
- Strategy: Merge methods, use DFB as evidence for PCMtuner

**PCMtuner ↔ Autotuner:**
- Same ECU model/MCU: Autotuner confirms chip spec
- DFB may not list this ECU; Autotuner + PCMtuner validate together
- Strategy: Link as supporting evidence, not duplicate

**Autotuner ↔ Multi-PROG:**
- Same MCU part number: validation
- Multi-PROG is source of truth for chip specs
- Strategy: Link as evidence, Multi-PROG is authoritative

---

## Evidence Assignment Strategy

Once deduplicated and staged, assign automatic evidence linking:

### PCMtuner Records
```
Evidence Type: "firmware_analysis" (guessed from vehicle data)
Weight: 80
Entity: vehicle_ecu_application
Verification Entity: "PCMtuner" (partner source)
Reason: "Vehicle make/model/year + ECU found in tool compatibility database"
```

### DFB Records
```
Evidence Type: "successful_write" (tool driver validates methods)
Weight: 85
Entity: tool_ecu_method
Verification Entity: "DFB Tool" (workshop/tool verified)
Reason: "DFB driver tested this ECU method with OBD/BOOT/BENCH modes"
```

### Autotuner Records
```
Evidence Type: "official_doc" (ECU specs)
Weight: 80
Entity: ecu_model
Verification Entity: "AutoTuner" (industry reference)
Reason: "ECU model specification from AutoTuner compatibility matrix"
```

### Multi-PROG Records
```
Evidence Type: "official_doc" (chip specifications)
Weight: 90
Entity: ecu_part_numbers
Verification Entity: "Multi-PROG" (chip manufacturer reference)
Reason: "Chip part number and MCU specification validated against Multi-PROG database"
```

---

## Validation Rules

**Required Fields Per Table:**

**vehicles:**
- make (required)
- model (required)
- year_start (optional, but if one then both)
- source_id (required)

**ecu_models:**
- manufacturer (required)
- model_code (required)
- source_id (required)

**vehicle_ecu_applications:**
- vehicle_id (required FK)
- ecu_model_id (required FK)
- source_id (required)
- confidence_score (required)

**tool_ecu_methods:**
- tool_id (required FK)
- ecu_model_id (required FK)
- method_type (required, enum)
- source_id (required)

**Validation Failures:**
- Missing required fields → reject record
- Invalid enum values → reject record
- Foreign key violations → resolve or reject
- Duplicate semantic fingerprint → flag for conflict review

---

## Rejection Handling

Records that fail validation go to `/datasets/rejected/`:

**validation_errors.json:**
```json
{
  "record": { original record },
  "errors": [
    "field: make, error: required but null",
    "field: year_start, error: invalid year (9999)"
  ],
  "source": "PCMtuner",
  "action_required": "manual_review"
}
```

**unresolved_conflicts.json:**
```json
{
  "fingerprint": "...",
  "existing": { from dataset A },
  "incoming": { from dataset B },
  "reason": "different ECU models for same vehicle",
  "action_required": "admin_resolution"
}
```

Admin reviews rejected records and decides:
- Fix and re-import
- Accept one version over the other
- Merge with manual adjustment
- Discard as invalid

---

## Import Statistics & Metadata

After normalization, generate `import_stats.json`:

```json
{
  "import_timestamp": "2026-05-26T12:00:00Z",
  "datasets": {
    "autotuner": {
      "source_file": "autotuner_compatibility_full.json",
      "raw_rows": 2066,
      "unique_rows": 767,
      "after_normalization": 765,
      "after_dedup": 765,
      "target_table": "ecu_models",
      "validation_errors": 2,
      "staging_records": 763
    },
    "pcmtuner": {
      "source_file": "pcmtuner_full_vehicle_database.json",
      "raw_rows": 7076,
      "after_normalization": 7050,
      "after_dedup": 6000,
      "target_tables": ["vehicles", "engines", "vehicle_ecu_applications"],
      "validation_errors": 5,
      "staging_records": 5995
    },
    // ... similar for DFB, Multi-PROG
  },
  "cross_dataset_deduplication": {
    "conflicts_detected": 47,
    "duplicates_resolved": 32,
    "conflicts_pending_review": 15
  },
  "total_staging_records": 18753,
  "total_validation_errors": 23,
  "total_unresolved_conflicts": 15,
  "next_step": "admin_review_conflicts"
}
```

---

## Next Action: Manual Dataset Analysis

Before building the implementation code:

1. **Manually analyze each dataset structure** to refine field mappings
2. **Test normalization rules** on sample rows from each dataset
3. **Validate cross-dataset overlap** (test DFB/PCMtuner deduplication logic)
4. **Document assumption corrections** from actual data patterns
5. **Confirm import order** matches strategy (PCMtuner → DFB → Autotuner → Multi-PROG)

**Then:** Build implementation in Week 1 after finalizing framework.

---

## Why This Approach

✅ **No data loss**: Original files preserved in `/datasets/raw/`
✅ **Traceability**: Every record has source attribution and confidence
✅ **Auditability**: Rejected/conflicted records visible for admin review
✅ **Testability**: Staging layer lets you validate before commit
✅ **Reversibility**: Can re-import with different normalization rules
✅ **Evidence linking**: Automatic confidence assignment based on source type
✅ **Deduplication**: Semantic fingerprinting prevents duplicate records
✅ **Conflict resolution**: Multi-source disagreements highlighted, not hidden

This framework prevents data pollution while maximizing signal from four complementary datasets.
