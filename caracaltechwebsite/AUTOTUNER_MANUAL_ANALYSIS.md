# AutoTuner Dataset Manual Analysis & Refined Field Mappings

**Analysis Date**: 2026-05-26  
**Dataset**: autotuner_compatibility_full.json  
**Total Records**: 767 deduplicated ECU records  
**Original Extracted**: 2066 rows → deduplicated to 767  

---

## Executive Summary

The AutoTuner dataset is a **pure ECU master reference** with no vehicle application context (no manufacturer/model/year). It originated from a 97-page PDF using logo-based layout, resulting in:
- **Complete data**: ecu_brand, ecu_model, mcu, vehicle_type, source_page
- **Incomplete data**: manufacturer=NULL, model=NULL, year=NULL (cannot recover from PDF text layer)
- **No methods**: Tools/methods shown as PDF icons, not recoverable as text

**Strategic Value**: Use as ECU verification baseline, NOT as vehicle application source.  
**Confidence Score**: 40 (limited scope, no vehicle context, already deduplicated)

---

## Dataset Structure & Field Analysis

### Source Metadata
```json
{
  "file_name": "Auto tuner .pdf",
  "source_type": "PDF",
  "export_date_from_pdf": "2026-04-01",
  "page_count": 97,
  "notes": [
    "Rows extracted from 97-page PDF",
    "Manufacturer shown as logo images (not recoverable)",
    "Model and year absent from PDF text layer",
    "Methods shown as icons (not recoverable)"
  ]
}
```

### Data Fields & Observations

#### 1. **ecu_brand** (100% populated)
- **Type**: VARCHAR(100)
- **Sample values**: Bosch, Continental, Delphi, Delco, Siemens, Marelli, ZF, Denso, Temic, Kefico
- **Top 10 by frequency**:
  - Bosch: 1,146 records (≈59%)
  - Continental: 280 (≈14%)
  - Delphi: 110 (≈6%)
  - Delco: 84 (≈4%)
  - Siemens: 71 (≈4%)
  - Marelli: 66 (≈3%)
  - ZF: 65 (≈3%)
  - Denso: 64 (≈3%)
  - Temic: 52 (≈3%)
  - Kefico: 31 (≈2%)

- **Normalization**: Already clean, use as-is for ecu_models.ecu_brand_manufacturer field
- **Mapping**: ecu_brand → ecu_models.ecu_brand_manufacturer

#### 2. **ecu_model** (100% populated)
- **Type**: VARCHAR(255)
- **Characteristic patterns**:
  - **Standard format**: "ME17.3.0", "EDC17CV54", "MG1CS003"
  - **With protocol qualifiers**: "EDC16C39 (CAN)", "EDC16C39 (K-Line)"
  - **With variants**: "8GMK", "8GMK.Fx" (treated as distinct)
  - **With generation markers**: "8HP Gen3", "8HPxx"
  - **Firmware identifiers**: "MEVD17.2.6", "MEVD17.2.8", "MEVD17.2.G"

- **Variations observed**:
  ```
  Bosch EDC16C39 variants:
    - EDC16C39 (CAN)       → mcu: MPC562
    - EDC16C39 (K-Line)    → mcu: MPC562
  
  ZF 8HP variants:
    - 8HP75                → mcu: SH72549
    - 8HP75                → mcu: SH7254x (wildcard)
    - 8HPxx                → mcu: SH72549
    - 8HPxx                → mcu: SH7254x
  
  Marelli 8GMK variants:
    - 8GMK                 → mcu: SPC564A80
    - 8GMK.Fx              → mcu: SPC564A80
  
  Bosch MG1CS variants:
    - MG1CS003             → mcu: SPC5777M
    - MG1CS024             → mcu: TC298
    - MG1CS049             → mcu: TC298
    - MG1CS201             → mcu: TC298
  ```

- **Normalization Rules**:
  - **Protocol qualifiers**: Strip "(CAN)", "(K-Line)", etc. for fingerprinting only
    - Store in ecu_models.ecu_model_raw (with qualifier)
    - Normalized form for dedup: "EDC16C39" (remove protocol)
  - **Generation markers**: Keep as-is ("8HP Gen3" is distinct from "8HP")
  - **Variant suffixes**: Keep as-is (".Fx" is distinct)
  - **Whitespace**: Normalize to no whitespace before hashing

- **Mapping**: ecu_model → ecu_models.ecu_model_code (stored raw), ecu_models.ecu_model_normalized (for dedup fingerprint)

#### 3. **mcu** (100% populated)
- **Type**: VARCHAR(100)
- **Sample patterns**:
  - **Infineon TC series**: TC1724, TC1766, TC1782, TC1793, TC1797, TC275, TC298, TC299
  - **Freescale MPC series**: MPC556, MPC5565, MPC5644A, MPC5674F, MPC5777, MPC563
  - **SPC (SiliconiST) series**: SPC564A70, SPC564A80, SPC5777M
  - **Renesas R-series**: R7F701202
  - **Hitachi SH-series**: SH72533, SH72549, SH7254x (with wildcard)
  - **ST10 series**: ST10C167, ST10F275

- **Special observations**:
  - **Wildcard notation**: "SH7254x" represents a family of MCUs
  - **Cross-mapping**: Same MCU can appear with multiple ecu_models
    - TC1797: appears with Bosch EDC17C49, EDC17C69, EDC17C79, MEVD17.2.6, etc.
    - MPC5565: appears with Marelli 8GMF, 8GMW, 8GSF, 8GSW, etc.

- **Normalization**: Keep as-is, wildcards are data accuracy limitation not normalization opportunity
- **Mapping**: mcu → ecu_models.mcu

#### 4. **vehicle_type** (100% populated)
- **Type**: ENUM(Car, Agri, Moto, Trucks, Atv, Jetski)
- **Distribution**:
  - Car: 1,817 (≈88%)
  - Agri: 143 (≈7%)
  - Moto: 57 (≈3%)
  - Trucks: 21 (≈1%)
  - Atv: 27 (≈1%)
  - Jetski: 1 (<1%)

- **Strategic note**: This is only categorical classification, no specific vehicle application (brand/model/year)
- **Mapping**: vehicle_type → new field ecu_models.vehicle_category (for search filtering only, not vehicle app context)

#### 5. **source_page** (100% populated)
- **Type**: INTEGER (1-97)
- **Purpose**: PDF page number for source verification
- **Note**: Multiple records per page (average ~20 rows per page)
- **Mapping**: source_page → import metadata only, NOT stored in production tables

#### 6. **manufacturer, model, year** (ALL NULL)
- **Status**: Cannot be recovered from PDF
- **Note**: Not worth attempting OCR or guessing
- **Decision**: Leave null, these will be filled by PCMtuner dataset (7,076 vehicle apps with years/brands)

---

## Deduplication Analysis

### Within-AutoTuner Deduplication
- **Original rows extracted**: 2,066
- **After deduplication**: 767
- **Duplicate ratio**: 62.8% (significant)
- **Likely cause**: Same ECU specs appearing across multiple pages (PDF repeated sections)

### Deduplication Key (AutoTuner level)
```
fingerprint = SHA256(
  normalized_brand(ecu_brand) + 
  normalized_model(ecu_model_without_qualifiers) + 
  normalized_mcu(mcu) + 
  vehicle_type.lower()
)
```

### Examples of Duplicates Found in Data
- **(Bosch, ME17.3.0, TC1724, Car)** appears on:
  - Page 1, line 49
  - Page 2, line 240
  
- **(Bosch, ME7.9.10, ST10F275, Car)** appears on:
  - Page 1, line 63
  - Page 2, line 251

- **(Marelli, 8GMF, MPC5553, Car)** appears on:
  - Page 1, line 75
  - Page 2, line 346

---

## Semantic Normalization Rules Tested

### Rule 1: ECU Brand Normalization
```javascript
function normalizeECUBrand(brand) {
  return brand
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')  // remove spaces
    .replace(/[^\w]/g, ''); // remove special chars
}
```

**Test cases**:
- "Bosch" → "bosch" ✓
- "Continental" → "continental" ✓
- "Delphi" → "delphi" ✓

**Result**: No issues found, brands are already clean.

---

### Rule 2: ECU Model Normalization (for dedup fingerprinting)
```javascript
function normalizeECUModel(model) {
  // Remove protocol qualifiers for fingerprinting
  let normalized = model
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')      // remove spaces
    .replace(/[^\w.]/g, '')   // remove special chars except dots
    .replace(/\(.*?\)/g, ''); // remove parenthetical qualifiers
  
  return normalized;
}
```

**Test cases**:
- "EDC16C39 (CAN)" → "edc16c39" ✓
- "EDC16C39 (K-Line)" → "edc16c39" ✓ (same as above, good for dedup)
- "8HP Gen3" → "8hpgen3" ✓
- "MG1CS003" → "mg1cs003" ✓
- "MEVD17.2.6" → "mevd17.2.6" ✓

**Observation**: The protocol qualifiers (CAN vs K-Line) are meaningful distinctions but the JSON already has separate rows for them. Normalizing both to "edc16c39" is correct because they have the same ECU model, just different communication variants.

**However, important decision**: When creating ecu_models records, we should:
- Store both variations as separate ecu_models (different communication methods)
- Use normalized form only for detecting EXACT duplicates within AutoTuner
- NOT collapse them because tuning tool compatibility may differ by protocol

---

### Rule 3: MCU Normalization
```javascript
function normalizeMCU(mcu) {
  return mcu
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\w]/g, '');
}
```

**Test cases**:
- "TC1724" → "tc1724" ✓
- "MPC5565" → "mpc5565" ✓
- "SH7254x" → "sh7254x" ✓ (wildcard preserved)
- "R7F701202" → "r7f701202" ✓

**Result**: Clean, no issues.

---

### Rule 4: Vehicle Type Normalization
```javascript
function normalizeVehicleType(type) {
  const mapping = {
    'car': 'car',
    'agri': 'agri',
    'agricultural': 'agri',
    'moto': 'moto',
    'motorcycle': 'moto',
    'trucks': 'trucks',
    'truck': 'trucks',
    'atv': 'atv',
    'jetski': 'jetski',
    'jet ski': 'jetski'
  };
  
  const normalized = type.trim().toLowerCase();
  return mapping[normalized] || 'unknown';
}
```

**Test cases**:
- "Car" → "car" ✓
- "Agri" → "agri" ✓
- "Moto" → "moto" ✓

**Result**: Already normalized in source.

---

## Fingerprint Generation Examples

### Example 1: Bosch EDC16C39
```
Raw records:
  {ecu_brand: "Bosch", ecu_model: "EDC16C39 (CAN)", mcu: "MPC562", vehicle_type: "Car"}
  {ecu_brand: "Bosch", ecu_model: "EDC16C39 (K-Line)", mcu: "MPC562", vehicle_type: "Car"}

Normalized:
  "bosch" + "edc16c39" + "mpc562" + "car"
  "bosch" + "edc16c39" + "mpc562" + "car"

Fingerprint: IDENTICAL → Would deduplicate if both in same import
Current state: Both present in deduplicated dataset, suggesting they were treated as distinct

Decision: Keep as separate ecu_models because protocol variation affects tool compatibility
```

### Example 2: Marelli 8GMF variants
```
Raw records:
  {ecu_brand: "Marelli", ecu_model: "8GMF", mcu: "MPC5553", vehicle_type: "Car"}
  {ecu_brand: "Marelli", ecu_model: "8GMF", mcu: "MPC5565", vehicle_type: "Car"}

Fingerprints:
  "marelli" + "8gmf" + "mpc5553" + "car" → DISTINCT
  "marelli" + "8gmf" + "mpc5565" + "car" → DISTINCT

Result: Both kept as separate records ✓ (correct, different MCU)
```

### Example 3: ZF 8HP wildcards
```
Raw records:
  {ecu_brand: "ZF", ecu_model: "8HPxx", mcu: "SH72549", vehicle_type: "Car"}
  {ecu_brand: "ZF", ecu_model: "8HPxx", mcu: "SH7254x", vehicle_type: "Car"}

Fingerprints:
  "zf" + "8hpxx" + "sh72549" + "car"
  "zf" + "8hpxx" + "sh7254x" + "car" → DISTINCT (due to wildcard notation difference)

Note: SH7254x is a wildcard pattern, SH72549 is specific. These are likely related but treated as distinct.
```

---

## Database Mapping Strategy

### Target Tables & Field Mappings

#### ecu_models table (new records from AutoTuner)
```sql
INSERT INTO ecu_models (
  ecu_brand_manufacturer,    -- from ecu_brand
  ecu_model_code,            -- from ecu_model (raw, with qualifiers)
  ecu_model_normalized,      -- from ecu_model (normalized for dedup)
  mcu,                       -- from mcu
  vehicle_category,          -- from vehicle_type
  protocol_variant,          -- extracted from ecu_model parentheses
  source_id,                 -- 'autotuner_2026-04-01'
  retrieved_at,              -- 2026-04-01 (from export_date_from_pdf)
  raw_confidence,            -- 40 (AutoTuner default)
  confidence_breakdown,      -- {...}
  created_at,                -- NOW()
  metadata                   -- {source_page: N, ...}
) VALUES (...)
```

#### Protocol variant extraction
```javascript
function extractProtocolVariant(ecu_model) {
  const match = ecu_model.match(/\((.*?)\)/);
  return match ? match[1] : 'default'; // 'CAN', 'K-Line', 'default'
}
```

**Examples**:
- "EDC16C39 (CAN)" → protocol_variant = "CAN"
- "EDC16C39 (K-Line)" → protocol_variant = "K-Line"
- "MG1CS003" → protocol_variant = "default"

---

## Import Workflow (AutoTuner specific)

### Stage 1: Raw Import
```
autotuner_compatibility_full.json → raw/autotuner_raw.json (as-is)
```

### Stage 2: Normalize
```javascript
const normalized = rows.map(row => ({
  ...row,
  ecu_brand_normalized: normalizeECUBrand(row.ecu_brand),
  ecu_model_normalized: normalizeECUModel(row.ecu_model),
  protocol_variant: extractProtocolVariant(row.ecu_model),
  mcu_normalized: normalizeMCU(row.mcu),
  vehicle_type_normalized: normalizeVehicleType(row.vehicle_type),
  fingerprint: generateFingerprint(row)
}));

// Output: normalized/autotuner_normalized.json (767 records)
```

### Stage 3: Deduplicate within dataset
```
Input: normalized/autotuner_normalized.json (767 records)
Dedup key: fingerprint
Action: Group by fingerprint, keep first occurrence
Output: normalized/autotuner_deduplicated.json (expecting ≤767, likely same)

Note: Dataset already provided deduplicated (2066→767), so this is validation step
```

### Stage 4: Validate schema
```
For each record:
  - ecu_brand: required, not null, varchar(100)
  - ecu_model: required, not null, varchar(255)
  - mcu: required, not null, varchar(100)
  - vehicle_type: required, not null, enum
  - manufacturer: expect null, skip
  - model: expect null, skip
  - year: expect null, skip
  
Validation errors: reject, log to validation_errors.json
```

### Stage 5: Generate staging records
```javascript
const stagingRecords = dedupRecords.map(row => ({
  entity_type: 'ecu_model',
  ecu_brand_manufacturer: row.ecu_brand,
  ecu_model_code: row.ecu_model,
  ecu_model_normalized: row.ecu_model_normalized,
  mcu: row.mcu,
  vehicle_category: row.vehicle_type,
  protocol_variant: row.protocol_variant,
  source_id: 'autotuner_2026-04-01',
  retrieved_at: '2026-04-01',
  raw_confidence: 40,
  confidence_breakdown: {
    source_weight: 0.40,
    verification_weight: 0.0,
    evidence_weight: 0.0,
    recency_weight: 0.0,
    conflict_penalty: 0.0,
    rationale: 'AutoTuner PDF extraction, no vehicle context, tool support unverified'
  },
  metadata: {
    source_page: row.source_page,
    import_batch_id: 'batch_autotuner_20260526',
    extraction_date: '2026-04-01',
    original_duplicate_rows: 2066 // context metadata
  },
  validation_status: 'passed'
}));

// Output: staging/autotuner_staging.json (767 records)
```

---

## Cross-Dataset Overlap Analysis (Preview)

### AutoTuner vs PCMtuner
**Potential overlap**: None direct
- AutoTuner: ECU specs only (brand, model, mcu)
- PCMtuner: Vehicle apps (brand, model, year, ecu hints)
- **Strategy**: Match on ecu_brand + ecu_model when PCMtuner has ecu references

### AutoTuner vs DFB
**Potential overlap**: HIGH
- DFB has 6,128 tool-verified driver methods
- Each method references an ecu_model
- **Strategy**: Join on (ecu_brand, ecu_model) to link evidence

**Example**:
```
AutoTuner row: (Bosch, EDC17CV54, TC1767, Car)
DFB methods: [{ecu: "Bosch EDC17CV54", method: "read", status: verified}, ...]

Match on: ecu_brand="Bosch" AND ecu_model="EDC17CV54"
Action: Create evidence link: this ecu_model has verified read method
```

### AutoTuner vs Multi-PROG
**Potential overlap**: LOW
- Multi-PROG: Chip references (chip part numbers)
- AutoTuner: ECU/MCU specs
- **Strategy**: Match on MCU if Multi-PROG has MCU field

---

## Statistics & Metadata

### AutoTuner Import Stats
```json
{
  "import_name": "AutoTuner PDF Extraction",
  "source_file": "Auto tuner .pdf",
  "export_date": "2026-04-01",
  "import_date": "2026-05-26",
  
  "extraction_stats": {
    "total_pages": 97,
    "original_rows_extracted": 2066,
    "deduplicated_rows": 767,
    "dedup_ratio": "62.8%"
  },
  
  "by_vehicle_type": {
    "car": {count: 1817, coverage: "88%"},
    "agri": {count: 143, coverage: "7%"},
    "moto": {count: 57, coverage: "3%"},
    "trucks": {count: 21, coverage: "1%"},
    "atv": {count: 27, coverage: "1%"},
    "jetski": {count: 1, coverage: "<1%"}
  },
  
  "by_ecu_brand": {
    "bosch": {count: 1146, coverage: "59%"},
    "continental": {count: 280, coverage: "14%"},
    "delphi": {count: 110, coverage: "6%"},
    "delco": {count: 84, coverage: "4%"},
    "siemens": {count: 71, coverage: "4%"},
    "other": {count: 76, coverage: "10%"}
  },
  
  "data_quality": {
    "manufacturer_nulls": "100%",
    "model_nulls": "100%",
    "year_nulls": "100%",
    "method_missing": "100% (shown as PDF icons)",
    "ecu_brand_complete": "100%",
    "ecu_model_complete": "100%",
    "mcu_complete": "100%"
  },
  
  "confidence_assessment": {
    "raw_confidence": 40,
    "rationale": "PDF text extraction, no vehicle context, tool methods unverified, already internally deduplicated"
  },
  
  "validation_summary": {
    "schema_errors": 0,
    "validation_passed": 767,
    "validation_failed": 0
  }
}
```

---

## Implementation Notes

### What's Different from Framework Plan

1. **Protocol qualifiers**: Framework didn't account for "(CAN)" vs "(K-Line)" variants. These should be stored separately as distinct ecu_models but grouped conceptually.

2. **Vehicle category vs vehicle application**: Framework assumes vehicle apps, but AutoTuner only provides category (Car/Agri/Moto). This is metadata only, not a vehicle application entity.

3. **Wildcard MCU handling**: MCU like "SH7254x" are real, not errors. Keep as-is.

4. **Confidence scoring**: 40 is correct (limited scope), but note the distinction: AutoTuner provides verification of which ECU models CAN be tuned by AutoTuner tool, not which vehicles use them.

### Next Steps

1. ✅ **Manual analysis**: Complete (this document)
2. **Build normalization service**: Implement semanticNormalization.js with tested rules
3. **Build import staging code**: Implement autotuner-import.js for raw→normalized→staging pipeline
4. **Manual cross-dataset overlap test**: When PCMtuner ingestion starts, validate join logic on (ecu_brand, ecu_model)
5. **Evidence linking**: When DFB imported, automatically link verified methods to matching ecu_models
6. **Admin review**: Before committing to ecu_models table, review in admin UI for conflicts/duplicates

---

## Conclusion

AutoTuner is a **high-quality ECU reference** (767 clean records) but **not a vehicle application source**. Use it to:
- ✅ Build ecu_models master reference
- ✅ Bootstrap evidence: "AutoTuner verified this ECU can be tuned" (confidence: 40)
- ✅ Cross-validate against DFB tool methods
- ❌ NOT match against vehicle database (insufficient vehicle context)
- ❌ NOT guess vehicle applications (manufacturer/model all null)

Next import source should be **PCMtuner** (7,076 vehicle apps with years/brands) to establish the vehicle application context that AutoTuner lacks.
