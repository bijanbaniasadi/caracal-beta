# Multi-Source Connector Architecture for Compatibility Intelligence

**Date**: 2026-05-26  
**Phase**: Extended Phase 0B.5 (after Week 1 backend stabilization)  
**Goal**: Build scalable ingestion and normalization framework for local + online sources  

---

## Overview

The system is expanding from **4 local JSON/XLSX datasets** to a **multi-source compatibility intelligence platform** capable of ingesting, normalizing, reconciling, and tracking evidence across:

### Local Sources (Immediate)
- ✅ AutoTuner PDF extraction (767 ECU specs)
- ✅ PCMtuner vehicle database (7,076 vehicle apps)
- ✅ DFB driver list (6,128 tool-verified methods)
- ✅ Multi-PROG chip reference (20,211 chip entries)

### Online Sources (Phase 2)
- Autotuner compatibility portal (web scraper)
- Alientech KESS3 vehicle list (API/scrape)
- PCMFlash module/connection documentation (PDF extraction)
- HP Tuners supported vehicles (portal scraper)
- Future vendor portals (template-based extraction)

---

## Source Connector Architecture

### Design: Pluggable Connector Pattern

Each source has a **connector** that:
1. **Reads** raw data (local file or web source)
2. **Normalizes** to canonical schema
3. **Outputs** staging records with source attribution
4. **Tracks** metadata (version, hash, retrieval date)

### Connector Interface (Abstract)

```javascript
class SourceConnector {
  constructor(sourceConfig) {
    this.sourceId = sourceConfig.sourceId;      // 'autotuner_2026-04-01'
    this.sourceName = sourceConfig.sourceName;  // 'AutoTuner PDF'
    this.sourceType = sourceConfig.sourceType;  // 'pdf', 'json', 'web', 'api'
    this.credibilityScore = sourceConfig.credibilityScore; // 0.40
  }
  
  async readRaw() {
    // Implemented by subclass
    // Returns: raw data structure
  }
  
  async normalize(rawData) {
    // Implemented by subclass
    // Returns: normalized staging records
  }
  
  async getSourceMetadata() {
    // Returns: source_version, source_hash, last_updated
  }
  
  async detectChanges(previousMetadata) {
    // Returns: change_detected, change_hash
  }
}
```

---

## Connector Implementations

### 1. Local JSON Connector

**Used by**: AutoTuner, PCMtuner, Multi-PROG

```javascript
class LocalJsonConnector extends SourceConnector {
  async readRaw() {
    const content = fs.readFileSync(this.filePath, 'utf8');
    return JSON.parse(content);
  }
  
  async normalize(rawData) {
    return rawData.rows.map(row => ({
      ...row,
      // Normalization applied by specific dataset handler
      source_id: this.sourceId,
      retrieved_at: new Date(rawData.source.export_date_from_pdf || Date.now()),
      raw_confidence: this.credibilityScore,
      import_metadata: {
        source_file: rawData.source.file_name,
        extraction_date: rawData.source.export_date_from_pdf,
        total_rows: rawData.summary.total_rows_extracted,
        dedup_rows: rawData.summary.unique_rows_deduplicated
      }
    }));
  }
  
  async getSourceMetadata() {
    const stats = fs.statSync(this.filePath);
    const content = fs.readFileSync(this.filePath, 'utf8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    
    return {
      source_version: '1.0', // from JSON schema version
      source_hash: hash.substring(0, 16),
      file_size_bytes: stats.size,
      file_mtime: stats.mtime,
      retrieval_date: new Date()
    };
  }
}
```

### 2. Local XLSX Connector

**Used by**: Excel compatibility files

```javascript
class LocalXlsxConnector extends SourceConnector {
  async readRaw() {
    const workbook = XLSX.readFile(this.filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet);
  }
  
  async normalize(rawData) {
    return rawData.map(row => ({
      // Map XLSX columns to canonical schema
      ecu_brand: row['ECU Brand'] || row['Manufacturer'],
      ecu_model: row['ECU Model'] || row['Model'],
      vehicle_brand: row['Vehicle Brand'] || row['Marque'],
      vehicle_model: row['Vehicle Model'],
      vehicle_year: row['Year'],
      method: row['Method'] || row['Access Method'],
      protocol: row['Protocol'] || row['Communication'],
      
      source_id: this.sourceId,
      retrieved_at: new Date(),
      raw_confidence: this.credibilityScore,
      import_metadata: {
        source_file: path.basename(this.filePath),
        sheet_name: workbook.SheetNames[0],
        row_count: rawData.length
      }
    }));
  }
}
```

### 3. Local PDF Metadata Connector

**Used by**: PCMFlash documentation extraction

```javascript
class LocalPdfMetadataConnector extends SourceConnector {
  async readRaw() {
    // For PDFs: extract text/metadata, use OCR if needed
    const pdfData = await pdfParse(fs.readFileSync(this.filePath));
    return {
      text: pdfData.text,
      metadata: pdfData.info,
      pages: pdfData.numpages,
      tables: await extractTablesFromPdf(this.filePath)
    };
  }
  
  async normalize(rawData) {
    // PDFs typically need table extraction + keyword parsing
    // Returns: structured compatibility records
    const records = [];
    
    for (const table of rawData.tables) {
      // Parse each table row into canonical schema
      const normalized = await this.normalizeTable(table);
      records.push(...normalized);
    }
    
    return records.map(r => ({
      ...r,
      source_id: this.sourceId,
      retrieved_at: new Date(),
      raw_confidence: this.credibilityScore,
      import_metadata: {
        source_file: path.basename(this.filePath),
        total_pages: rawData.pages,
        extraction_method: 'pdf_table_extraction'
      }
    }));
  }
}
```

### 4. Web Scraper Connector

**Used by**: Autotuner portal, KESS3, HP Tuners

```javascript
class WebScraperConnector extends SourceConnector {
  async readRaw() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(this.sourceUrl);
    
    // Extract structured data from page
    const data = await page.evaluate(() => {
      return document.querySelectorAll('table, div[data-vehicle], ul[data-model]');
    });
    
    // Handle pagination
    const allData = [data];
    while (await this.hasNextPage(page)) {
      await page.click('a[rel="next"]');
      await page.waitForNavigation();
      const nextData = await page.evaluate(() => {
        // Extract same structure from next page
      });
      allData.push(nextData);
    }
    
    await browser.close();
    return allData.flat();
  }
  
  async normalize(rawData) {
    return rawData.map(row => {
      // Parse HTML/DOM into canonical schema
      return {
        ecu_brand: row.querySelector('[data-ecu-brand]')?.textContent,
        ecu_model: row.querySelector('[data-ecu-model]')?.textContent,
        vehicle_brand: row.querySelector('[data-vehicle-brand]')?.textContent,
        // ... etc
        
        source_id: this.sourceId,
        retrieved_at: new Date(),
        raw_confidence: this.credibilityScore,
        import_metadata: {
          source_url: this.sourceUrl,
          extraction_date: new Date(),
          page_count: this.lastPageCount,
          extraction_method: 'web_scraper'
        }
      };
    });
  }
  
  async getSourceMetadata() {
    const response = await fetch(this.sourceUrl);
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');
    
    return {
      source_version: etag || 'unknown',
      source_hash: etag?.substring(0, 16) || 'unknown',
      retrieval_date: new Date(),
      last_modified: lastModified
    };
  }
  
  async detectChanges(previousMetadata) {
    const current = await this.getSourceMetadata();
    return {
      change_detected: current.source_version !== previousMetadata.source_version,
      change_hash: current.source_hash,
      change_type: 'version_update'
    };
  }
}
```

### 5. Vendor API Connector (Template for future)

```javascript
class VendorApiConnector extends SourceConnector {
  async readRaw() {
    const client = new ApiClient(this.sourceConfig.apiKey);
    const data = await client.getCompatibilityData(
      this.sourceConfig.endpoint,
      this.sourceConfig.filters
    );
    return data;
  }
  
  async normalize(rawData) {
    // Parse vendor API schema to canonical
    return rawData.vehicles.map(vehicle => ({
      vehicle_brand: vehicle.manufacturer,
      vehicle_model: vehicle.model,
      vehicle_year: vehicle.year,
      ecu_brand: vehicle.ecu?.brand,
      ecu_model: vehicle.ecu?.model,
      method: vehicle.support?.method,
      // ... etc
      
      source_id: this.sourceId,
      retrieved_at: new Date(),
      raw_confidence: this.credibilityScore,
      import_metadata: {
        api_version: rawData.version,
        api_request_date: rawData.request_date
      }
    }));
  }
}
```

---

## Canonical Normalization Pipeline

### Normalization Layers

Each record flows through 7 normalization layers:

#### Layer 1: Text Normalization
```javascript
function normalizeText(text, field_type) {
  if (!text) return null;
  
  let normalized = text
    .trim()
    .replace(/\s+/g, ' ')           // collapse whitespace
    .toLowerCase()                   // lowercase for comparison
    .replace(/[^\w\s\-\.]/g, '');   // remove special chars
  
  // Field-specific rules
  if (field_type === 'ecu_model') {
    normalized = normalized
      .replace(/\(.*?\)/g, '')       // remove protocol qualifiers for canonical
      .replace(/\bgen\d+\b/g, '')    // remove generation markers
      .replace(/\bv?\d+\.\d+\.\d+\b/g, ''); // remove version numbers
  }
  
  return normalized;
}
```

#### Layer 2: ECU Brand Canonicalization
```javascript
const ecuBrandAliases = {
  'bosch': ['bosch', 'bosch-siemens', 'bse'],
  'continental': ['continental', 'siemens', 'vdo', 'conti'],
  'delphi': ['delphi', 'delco', 'delphi-delco'],
  'marelli': ['marelli', 'magneti marelli', 'magneti-marelli'],
  'siemens': ['siemens', 'siemens-vdo'],
  'denso': ['denso', 'denso-delphi'],
  'zf': ['zf', 'zf-sachs', 'zf transmission'],
  'getrag': ['getrag'],
  'keihin': ['keihin'],
  'hitachi': ['hitachi', 'hitachi-nec'],
  'infineon': ['infineon'],
  'freescale': ['freescale', 'motorola'],
  'st': ['st microelectronics', 'stm'],
  'renesas': ['renesas']
};

function canonicalizeEcuBrand(brand) {
  const normalized = normalizeText(brand);
  for (const [canonical, aliases] of Object.entries(ecuBrandAliases)) {
    if (aliases.includes(normalized)) {
      return canonical;
    }
  }
  return normalized; // fallback: use as-is if no alias match
}
```

#### Layer 3: ECU Model Family Recognition
```javascript
const ecuModelFamilies = {
  'bosch_me': /me\d+\.?\d*\.?\d*/i,
  'bosch_med': /med\d+\.?\d*\.?\d*/i,
  'bosch_edc15': /edc15/i,
  'bosch_edc16': /edc16/i,
  'bosch_edc17': /edc17/i,
  'bosch_mg1': /mg1cs\d+/i,
  'bosch_md1': /md1[cp]\d*/i,
  'bosch_mevd': /mevd\d+\.?\d*\.?\d*/i,
  'siemens_msd': /msd\d+/i,
  'continental_gpec': /gpec\d*/i,
  'marelli_8gm': /8gm[a-z]/i,
  'marelli_8gs': /8gs[a-z]/i,
  'marelli_10ja': /10ja/i,
  'marelli_mjd': /mjd\d+/i,
  'zf_8hp': /8hp/i,
  'zf_6hp': /6hp/i,
  'delphi_dcm': /dcm\d+/i
};

function recognizeEcuFamily(ecu_brand, ecu_model) {
  const key = `${ecu_brand}_${ecu_model}`.toLowerCase();
  
  for (const [family, pattern] of Object.entries(ecuModelFamilies)) {
    if (pattern.test(ecu_model)) {
      return family;
    }
  }
  
  return `${ecu_brand}_${ecu_model}`.toLowerCase();
}
```

#### Layer 4: Vehicle Name Normalization
```javascript
const vehicleBrandAliases = {
  'audi': ['audi', 'vw-audi', 'audiag'],
  'bmw': ['bmw', 'bayerische'],
  'ford': ['ford', 'ford-europe', 'ford-motor'],
  'vw': ['volkswagen', 'vw', 'vw-group'],
  'mercedes': ['mercedes', 'daimler', 'mercedes-benz', 'mbz'],
  'porsche': ['porsche'],
  'fiat': ['fiat', 'fca'],
  'tesla': ['tesla', 'tesla-inc'],
  'toyota': ['toyota', 'daihatsu'],
  'honda': ['honda'],
  'hyundai': ['hyundai', 'kia'],
  'jaguar': ['jaguar', 'land-rover', 'jlr'],
  'volvo': ['volvo', 'geely', 'polestar'],
  'renault': ['renault', 'nissan', 'mitsubishi'],
  'psa': ['peugeot', 'citroen', 'ds', 'opel'],
  'lamborghini': ['lamborghini', 'audi-lamborghini'],
  'ferrari': ['ferrari'],
  'maserati': ['maserati']
};

function canonicalizeVehicleBrand(brand) {
  const normalized = normalizeText(brand);
  for (const [canonical, aliases] of Object.entries(vehicleBrandAliases)) {
    if (aliases.includes(normalized)) {
      return canonical;
    }
  }
  return normalized;
}
```

#### Layer 5: Method Canonicalization
```javascript
const methodAliases = {
  'obd': ['obd', 'obd2', 'obd-ii'],
  'bench': ['bench', 'boot', 'bench-mode', 'bootmode'],
  'jtag': ['jtag', 'cjtag', 'swd'],
  'bdm': ['bdm', 'background-debug'],
  'can': ['can', 'canoe'],
  'k-line': ['k-line', 'kwp', 'iso9141'],
  'bootloader': ['bootloader', 'boot-loader'],
  'clone': ['clone', 'cloning', 'full-read'],
  'direct': ['direct', 'direct-access']
};

function canonicalizeMethod(method) {
  if (!method) return null;
  
  const normalized = normalizeText(method);
  for (const [canonical, aliases] of Object.entries(methodAliases)) {
    if (aliases.includes(normalized)) {
      return canonical;
    }
  }
  return normalized;
}
```

#### Layer 6: Protocol Canonicalization
```javascript
const protocolAliases = {
  'obd2': ['obd', 'obd2', 'obd-ii', 'j1939'],
  'k-line': ['k-line', 'k-line-slow', 'kwp', 'kwp1281', 'iso9141'],
  'can': ['can', 'iso15765', 'canbus'],
  'lin': ['lin', 'lin-bus'],
  'j1850': ['j1850', 'vpw', 'pwm']
};

function canonicalizeProtocol(protocol) {
  const normalized = normalizeText(protocol);
  for (const [canonical, aliases] of Object.entries(protocolAliases)) {
    if (aliases.includes(normalized)) {
      return canonical;
    }
  }
  return normalized;
}
```

#### Layer 7: MCU Canonicalization
```javascript
const mcuFamilies = {
  'infineon_tc1': /^tc1\d+/i,
  'infineon_tc2': /^tc2\d+/i,
  'infineon_tc3': /^tc3\d+/i,
  'freescale_mpc5': /^mpc5\d+/i,
  'freescale_mpc56': /^mpc56\d+/i,
  'st_spc': /^spc\d+/i,
  'renesas_r7f': /^r7f\d+/i,
  'renesas_sh': /^sh\d+/i,
  'infineon_st10': /^st10/i,
  'motorola_68': /^68[0-9kv]/i
};

function recognizeMcuFamily(mcu) {
  for (const [family, pattern] of Object.entries(mcuFamilies)) {
    if (pattern.test(mcu)) {
      return family;
    }
  }
  return 'unknown';
}
```

### Full Normalization Pipeline

```javascript
function normalizeCompatibilityRecord(raw_record, source_type) {
  return {
    // Canonical ECU identification
    ecu_brand: canonicalizeEcuBrand(raw_record.ecu_brand),
    ecu_model: normalizeText(raw_record.ecu_model, 'ecu_model'),
    ecu_family: recognizeEcuFamily(raw_record.ecu_brand, raw_record.ecu_model),
    
    // Canonical vehicle identification
    vehicle_brand: canonicalizeVehicleBrand(raw_record.vehicle_brand),
    vehicle_model: normalizeText(raw_record.vehicle_model, 'vehicle_model'),
    vehicle_year: parseInt(raw_record.vehicle_year) || null,
    vehicle_category: normalizeVehicleType(raw_record.vehicle_type),
    
    // Canonical method/protocol
    method: canonicalizeMethod(raw_record.method),
    protocol: canonicalizeProtocol(raw_record.protocol),
    protocol_variant: extractProtocolVariant(raw_record.ecu_model),
    
    // MCU identification
    mcu: normalizeText(raw_record.mcu),
    mcu_family: recognizeMcuFamily(raw_record.mcu),
    
    // Tuning tool identification
    tuning_tool: canonicalizeTuningTool(raw_record.tuning_tool),
    
    // Engine specification (if present)
    engine_code: raw_record.engine_code,
    fuel_type: canonicalizeFuelType(raw_record.fuel_type),
    displacement: raw_record.displacement_cc,
    power_hp: raw_record.power_hp,
    
    // Regional/market info
    market: normalizeMarket(raw_record.market),
    region_gcc: raw_record.region_gcc === true,
    
    // Source attribution
    source_id: raw_record.source_id,
    retrieved_at: raw_record.retrieved_at,
    raw_confidence: raw_record.raw_confidence,
    
    // Fingerprints for dedup/linking
    ecu_fingerprint: generateFingerprint(['ecu_brand', 'ecu_model', 'mcu']),
    vehicle_fingerprint: generateFingerprint(['vehicle_brand', 'vehicle_model', 'vehicle_year']),
    application_fingerprint: generateFingerprint(['vehicle_brand', 'vehicle_model', 'vehicle_year', 'engine_code', 'ecu_brand', 'ecu_model']),
    
    import_metadata: raw_record.import_metadata
  };
}
```

---

## Multi-Source Reconciliation Engine

### Challenge: Same ECU/Method, Different Sources

**Example**: Bosch ME17.3.0 appears in:
- AutoTuner: "tool can tune it" (confidence: 40)
- KESS3: "fully supported" (confidence: 75)
- PCMFlash: "limited support" (confidence: 55)

### Reconciliation Strategy

#### Step 1: Entity Matching
```javascript
function matchEntitiesAcrossSources(records) {
  // Group by canonical identifiers
  const groups = new Map();
  
  for (const record of records) {
    const key = generateComparisonKey(record);
    // key = 'bosch|me17.3.0|TC1724'
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(record);
  }
  
  return groups;
}

function generateComparisonKey(record) {
  return [
    record.ecu_brand,
    record.ecu_model,
    record.mcu
  ].filter(v => v !== null).join('|');
}
```

#### Step 2: Source Conflict Detection
```javascript
function detectConflicts(sourceGroup) {
  if (sourceGroup.length < 2) return null;
  
  const conflicts = [];
  
  for (let i = 0; i < sourceGroup.length - 1; i++) {
    for (let j = i + 1; j < sourceGroup.length; j++) {
      const conflict = detectRecordConflict(sourceGroup[i], sourceGroup[j]);
      if (conflict) {
        conflicts.push(conflict);
      }
    }
  }
  
  return conflicts.length > 0 ? conflicts : null;
}

function detectRecordConflict(record1, record2) {
  const conflicts = {
    method_mismatch: record1.method !== record2.method,
    protocol_mismatch: record1.protocol !== record2.protocol,
    vehicle_mismatch: record1.vehicle_model !== record2.vehicle_model,
    vehicle_year_mismatch: Math.abs((record1.vehicle_year || 0) - (record2.vehicle_year || 0)) > 2,
    unlock_requirement_mismatch: record1.requires_unlock !== record2.requires_unlock,
    cloning_support_mismatch: record1.cloning_support !== record2.cloning_support
  };
  
  if (Object.values(conflicts).some(v => v === true)) {
    return {
      record1_source: record1.source_id,
      record2_source: record2.source_id,
      conflict_details: conflicts
    };
  }
  
  return null;
}
```

#### Step 3: Evidence Aggregation
```javascript
function aggregateEvidence(sourceGroup) {
  const aggregated = {
    ecu_brand: sourceGroup[0].ecu_brand,
    ecu_model: sourceGroup[0].ecu_model,
    mcu: sourceGroup[0].mcu,
    
    method_votes: {},      // vote on method
    protocol_votes: {},    // vote on protocol
    vehicle_models: [],    // all vehicle models this ECU is used in
    
    sources: sourceGroup.map(r => ({
      source_id: r.source_id,
      confidence: r.raw_confidence,
      method: r.method,
      protocol: r.protocol,
      vehicle_models: [r.vehicle_model],
      retrieved_at: r.retrieved_at
    })),
    
    conflicts: detectConflicts(sourceGroup)
  };
  
  // Vote on method (weighted by source confidence)
  for (const source of sourceGroup) {
    if (source.method) {
      const key = source.method;
      aggregated.method_votes[key] = (aggregated.method_votes[key] || 0) + source.raw_confidence;
    }
  }
  
  // Determine consensus method
  const consensusMethod = Object.entries(aggregated.method_votes)
    .sort((a, b) => b[1] - a[1])[0];
  aggregated.consensus_method = consensusMethod ? consensusMethod[0] : null;
  
  return aggregated;
}
```

#### Step 4: Evidence Linking
```javascript
function linkEvidenceAcrossSources(aggregated) {
  // Create evidence records linking sources
  const evidence = {
    entity_type: 'ecu_model',
    entity_id: aggregated.ecu_id,
    
    evidence_links: aggregated.sources.map(source => ({
      evidence_type: 'tool_compatibility',
      source_id: source.source_id,
      evidence_weight: source.confidence,
      claim: `${source.source_id} supports ${aggregated.consensus_method} method`,
      verified: source.confidence > 0.60,
      retrieved_at: source.retrieved_at
    })),
    
    conflict_evidence: aggregated.conflicts ? [{
      evidence_type: 'conflicting_claim',
      conflict_summary: aggregated.conflicts,
      requires_manual_review: true
    }] : []
  };
  
  return evidence;
}
```

---

## Source Freshness Tracking

### Source Metadata Table

```sql
CREATE TABLE source_freshness_tracking (
  id BIGSERIAL PRIMARY KEY,
  source_id VARCHAR(255) NOT NULL UNIQUE,
  source_name VARCHAR(255),
  source_type ENUM('local_json', 'local_xlsx', 'web_scraper', 'api'),
  
  last_sync_at TIMESTAMP,
  last_change_detected_at TIMESTAMP,
  source_version VARCHAR(255),
  source_hash VARCHAR(32),
  
  record_count_last_sync INTEGER,
  record_count_current INTEGER,
  
  ecu_models_added INTEGER DEFAULT 0,
  ecu_models_removed INTEGER DEFAULT 0,
  ecu_models_modified INTEGER DEFAULT 0,
  
  methods_added INTEGER DEFAULT 0,
  protocols_added INTEGER DEFAULT 0,
  
  change_detected BOOLEAN DEFAULT FALSE,
  change_type ENUM('version_update', 'content_change', 'no_change'),
  
  notification_sent_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Change Detection Logic

```javascript
async function detectSourceChanges(sourceId, previousMetadata) {
  const connector = getConnector(sourceId);
  const currentMetadata = await connector.getSourceMetadata();
  
  const changes = {
    source_id: sourceId,
    version_changed: currentMetadata.source_version !== previousMetadata.source_version,
    hash_changed: currentMetadata.source_hash !== previousMetadata.source_hash,
    last_modified_changed: new Date(currentMetadata.last_modified) > 
                           new Date(previousMetadata.last_modified),
    
    change_detected: false,
    change_type: 'no_change'
  };
  
  if (changes.version_changed || changes.hash_changed || changes.last_modified_changed) {
    changes.change_detected = true;
    changes.change_type = 'version_update';
    
    // Fetch new data and do deeper comparison
    const currentData = await connector.readRaw();
    const previousData = JSON.parse(fs.readFileSync(previousMetadata.cache_path, 'utf8'));
    
    const diff = deepDiff(previousData, currentData);
    changes.added_count = diff.added.length;
    changes.removed_count = diff.removed.length;
    changes.modified_count = diff.modified.length;
    
    if (diff.added.length > 0 || diff.removed.length > 0) {
      changes.change_type = 'content_change';
    }
  }
  
  return changes;
}
```

---

## Compatibility Diff Engine

### Diff Detection

```javascript
async function generateCompatibilityDiff(sourceId, previousRecords, currentRecords) {
  const diffs = {
    source_id: sourceId,
    newly_supported_ecus: [],
    removed_support_ecus: [],
    method_changes: [],
    protocol_additions: [],
    vehicle_coverage_changes: [],
    
    diff_events: []
  };
  
  // Find new ECU support
  for (const currentRecord of currentRecords) {
    const key = generateComparisonKey(currentRecord);
    const previousRecord = previousRecords.find(r => generateComparisonKey(r) === key);
    
    if (!previousRecord) {
      diffs.newly_supported_ecus.push(currentRecord);
      diffs.diff_events.push({
        event_type: 'ecu.newly_supported',
        ecu_brand: currentRecord.ecu_brand,
        ecu_model: currentRecord.ecu_model,
        method: currentRecord.method
      });
    }
  }
  
  // Find removed ECU support
  for (const previousRecord of previousRecords) {
    const key = generateComparisonKey(previousRecord);
    const currentRecord = currentRecords.find(r => generateComparisonKey(r) === key);
    
    if (!currentRecord) {
      diffs.removed_support_ecus.push(previousRecord);
      diffs.diff_events.push({
        event_type: 'ecu.support_removed',
        ecu_brand: previousRecord.ecu_brand,
        ecu_model: previousRecord.ecu_model,
        method: previousRecord.method
      });
    }
  }
  
  // Find method changes on same ECU
  for (const currentRecord of currentRecords) {
    const key = generateComparisonKey(currentRecord);
    const previousRecord = previousRecords.find(r => generateComparisonKey(r) === key);
    
    if (previousRecord && previousRecord.method !== currentRecord.method) {
      diffs.method_changes.push({
        ecu: key,
        previous_method: previousRecord.method,
        current_method: currentRecord.method
      });
      diffs.diff_events.push({
        event_type: 'method.changed',
        ecu_brand: currentRecord.ecu_brand,
        ecu_model: currentRecord.ecu_model,
        old_method: previousRecord.method,
        new_method: currentRecord.method
      });
    }
  }
  
  return diffs;
}
```

---

## Source Classification Schema

### Vendor Source Reliability Tiers

```javascript
const sourceClassifications = {
  'official_vendor': {
    tier: 1,
    credibility_multiplier: 1.0,
    examples: [
      'autotuner_portal_official',
      'pcmflash_official_docs',
      'hp_tuners_official'
    ],
    description: 'Official vendor compatibility documentation'
  },
  
  'official_documentation': {
    tier: 2,
    credibility_multiplier: 0.85,
    examples: [
      'kess3_manual',
      'alientech_guide',
      'obd_connect_docs'
    ],
    description: 'Official manual/guide but not live database'
  },
  
  'workshop_verified': {
    tier: 3,
    credibility_multiplier: 0.70,
    examples: [
      'workshop_tuner_feedback',
      'verified_ecu_database'
    ],
    description: 'Verified by professional tuning workshops'
  },
  
  'community_verified': {
    tier: 4,
    credibility_multiplier: 0.50,
    examples: [
      'forum_reports',
      'user_submissions'
    ],
    description: 'Community-verified compatibility reports'
  },
  
  'inferred': {
    tier: 5,
    credibility_multiplier: 0.35,
    examples: [
      'parsed_from_pdf',
      'guessed_from_context'
    ],
    description: 'Inferred from indirect sources'
  },
  
  'reverse_engineered': {
    tier: 6,
    credibility_multiplier: 0.25,
    examples: [
      'protocol_analysis',
      'firmware_examination'
    ],
    description: 'Determined through reverse engineering'
  }
};
```

---

## Implementation Roadmap

### Phase 1: Local Source Connectors (Week 2-3 of Phase 0B.5)
- ✅ LocalJsonConnector (AutoTuner, PCMtuner, Multi-PROG)
- ✅ LocalXlsxConnector (Excel files)
- ✅ LocalPdfMetadataConnector (PDF extraction)

### Phase 2: Normalization Pipeline (Week 4)
- ✅ Text normalization layer
- ✅ ECU brand/model canonicalization
- ✅ Vehicle brand canonicalization
- ✅ Method/protocol canonicalization
- ✅ MCU family recognition

### Phase 3: Reconciliation Engine (Week 5-6)
- ✅ Entity matching across sources
- ✅ Conflict detection
- ✅ Evidence aggregation
- ✅ Consensus calculation

### Phase 4: Web Sources (Phase 0C)
- WebScraperConnector for vendor portals
- KESS3 structure analysis
- PCMFlash documentation parsing
- HP Tuners portal scraping

### Phase 5: Future Updates (Phase 0D)
- Periodic source refresh scheduler
- Change detection infrastructure
- Diff-based update notifications
- Admin UI for conflict resolution

---

## Critical Design Decisions

1. **No direct web data to production**: All web sources follow raw → normalized → staging → validation → commit pipeline

2. **Source attribution is mandatory**: Every record carries source_id, retrieved_at, raw_confidence

3. **Conflict detection, not auto-resolution**: System detects disagreements but flags for manual review

4. **Evidence inheritance**: Multiple sources → single evidence entity, not duplicate records

5. **Freshness tracking**: Monitor all sources for version/content changes

6. **Confidence is source-dependent**: AutoTuner (40) vs KESS3 (75) vs DFB (70) weights evidence differently

---

## Next Actions

1. Build LocalJsonConnector with AutoTuner + PCMtuner test
2. Implement canonical normalization pipeline
3. Test cross-source entity matching on AutoTuner + DFB overlap
4. Build conflict detection on known disagreements
5. Create admin conflict review UI (mock)
6. Design source freshness tracking queries
