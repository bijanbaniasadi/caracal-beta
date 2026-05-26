# Online Sources Structure Analysis: KESS3, PCMFlash, HP Tuners

**Date**: 2026-05-26  
**Status**: Architectural Planning (Phase 0C)  
**Purpose**: Analyze online vendor sources for web scraper integration

---

## Executive Summary

Three major online compatibility sources will extend the platform beyond local datasets:

| Source | Type | Estimated Coverage | Update Frequency | Integration Difficulty |
|--------|------|-------------------|------------------|----------------------|
| KESS3 Portal | Vehicle compatibility | 15,000+ vehicles | Monthly-Quarterly | Medium |
| PCMFlash Docs | Module/connection list | 10,000+ modules | Quarterly | Medium-High (OCR) |
| HP Tuners | Supported vehicles | 5,000+ vehicles | Monthly | Low |

**Strategic Sequencing**: Implement in order: HP Tuners (simplest) → KESS3 (moderate) → PCMFlash docs (complex OCR)

---

## 1. KESS3 Compatibility Structure

### Source Overview
- **Official vendor**: Alientech KESS3 (tuning tool)
- **URL pattern**: https://www.alientech-kessv3.com/compatibility or vendor portal
- **Data type**: Vehicle compatibility matrix
- **Estimated records**: 15,000+ vehicle models across 100+ brands
- **Typical fields**: Brand, model, year range, engine variant, ECU type, supported methods

### Expected HTML Structure

```html
<!-- Vehicle browser/selector on KESS3 portal -->
<div class="vehicle-list">
  <div class="vehicle-entry" data-vehicle-id="123">
    <span class="vehicle-brand">Audi</span>
    <span class="vehicle-model">A4</span>
    <span class="vehicle-year-range">2015-2020</span>
    <span class="vehicle-engine">2.0 TFSI</span>
    
    <!-- Expandable compatibility details -->
    <div class="compatibility-details" style="display:none;">
      <table>
        <tr>
          <td class="ecu-type">Bosch</td>
          <td class="ecu-model">MED17.5</td>
          <td class="method">Read/Write</td>
          <td class="protocol">CAN</td>
          <td class="support-status">Fully supported</td>
        </tr>
        <tr>
          <td class="ecu-type">Bosch</td>
          <td class="ecu-model">EDC17C68</td>
          <td class="method">Read only</td>
          <td class="protocol">K-Line</td>
          <td class="support-status">Limited</td>
        </tr>
      </table>
    </div>
  </div>
  
  <!-- Pagination -->
  <div class="pagination">
    <a href="?page=2" rel="next">Next</a>
  </div>
</div>
```

### Data Extraction Strategy

```javascript
class Kess3WebScraper extends WebScraperConnector {
  async extractVehicles(page) {
    const vehicles = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('.vehicle-entry').forEach(entry => {
        results.push({
          vehicle_brand: entry.querySelector('.vehicle-brand')?.textContent?.trim(),
          vehicle_model: entry.querySelector('.vehicle-model')?.textContent?.trim(),
          vehicle_year_start: parseInt(
            entry.querySelector('.vehicle-year-range')?.textContent?.split('-')[0]
          ),
          vehicle_year_end: parseInt(
            entry.querySelector('.vehicle-year-range')?.textContent?.split('-')[1]
          ),
          engine_variant: entry.querySelector('.vehicle-engine')?.textContent?.trim(),
          
          // Expand compatibility details
          ecu_details: this.extractEcuDetails(entry)
        });
      });
      return results;
    });
    
    return vehicles;
  }
  
  extractEcuDetails(vehicleEntry) {
    // Click expand button to reveal table
    // Parse table rows into objects
    return [{
      ecu_brand: row.querySelector('.ecu-type')?.textContent?.trim(),
      ecu_model: row.querySelector('.ecu-model')?.textContent?.trim(),
      method: row.querySelector('.method')?.textContent?.trim(),
      protocol: row.querySelector('.protocol')?.textContent?.trim(),
      support_level: row.querySelector('.support-status')?.textContent?.trim()
    }];
  }
  
  async scrapeAllPages() {
    const allRecords = [];
    let currentPage = 1;
    let hasNext = true;
    
    while (hasNext && currentPage <= 100) { // safety limit
      const pageVehicles = await this.extractVehicles(page);
      allRecords.push(...pageVehicles);
      
      // Check for next page
      const nextLink = await page.$('a[rel="next"]');
      if (nextLink) {
        await nextLink.click();
        await page.waitForNavigation();
      } else {
        hasNext = false;
      }
      
      currentPage++;
    }
    
    return allRecords;
  }
}
```

### Normalization Mapping

```javascript
// KESS3 → Canonical schema
{
  vehicle_brand: canonicalizeVehicleBrand(raw.vehicle_brand),
  vehicle_model: normalizeText(raw.vehicle_model),
  vehicle_year: raw.vehicle_year_start, // use start of range
  vehicle_year_end: raw.vehicle_year_end,
  engine_code: raw.engine_variant,
  
  ecu_brand: canonicalizeEcuBrand(raw.ecu_type),
  ecu_model: normalizeEcuModel(raw.ecu_model),
  method: canonicalizeMethod(raw.method),
  protocol: canonicalizeProtocol(raw.protocol),
  
  tuning_tool: 'kess3',
  support_level: {
    raw: raw.support_status, // 'Fully supported', 'Limited', 'Read only'
    normalized: normalizeKess3SupportLevel(raw.support_status)
  },
  
  source_id: 'kess3_vendor_portal',
  retrieved_at: new Date(),
  raw_confidence: 0.75, // Official vendor = high confidence
  
  import_metadata: {
    source_url: 'https://www.alientech-kessv3.com/compatibility',
    extraction_method: 'web_scraper',
    vehicle_id: raw.vehicle_id
  }
}
```

### Expected Conflicts vs Local Data

**KESS3 claims**:
- Audi A4 (2015-2020) with Bosch MED17.5: "Fully supported"

**vs Local sources**:
- AutoTuner: No Audi data (only ECU specs)
- PCMtuner: May claim "limited support" for older MY
- DFB: May claim "read only"

**Reconciliation**:
- KESS3 (75) + DFB (70) = weighted average (72)
- Conflict flag: KESS3 says "full" vs DFB says "read only"
- Admin review: actual capability = "full support but no cloning"

---

## 2. PCMFlash Module Documentation Structure

### Source Overview
- **Official vendor**: PCMFlash (module/connection documentation)
- **Document type**: PDF technical manual
- **Location**: https://pcmflash.com/manuals/ or physical PDFs
- **Estimated modules**: 10,000+ ECU module variants
- **Typical content**: Module name, ECU models supported, connection methods, pin configurations

### Expected PDF Content

```
Page 1-2: Module Overview
  PCMFlash Module ID: BDM-M1000
  Module Name: "BDM Interface for HCS12X"
  Supported ECUs:
    - Bosch EDC17C39
    - Bosch EDC17CV54
    - Continental GPEC4
    - Delphi DCM3.7
    
Page 3-5: Connection Diagrams
  [ASCII diagrams showing pin configurations]
  Connection method: K-Line
  Baud rate: 9600 / 14400
  
Page 6: Supported ECU List (TABLE)
  | ECU Brand | ECU Model | Connection | Status |
  |-----------|-----------|------------|--------|
  | Bosch     | EDC16C39  | K-Line     | Native |
  | Bosch     | EDC16CAN  | CAN        | Adapter|
  | Siemens   | MSD81     | JTAG       | Full   |
  
Page 7: Configuration Settings
  [Hex dumps, configuration parameters]
```

### Data Extraction Strategy

```javascript
class PcmflashPdfExtractor extends LocalPdfMetadataConnector {
  async extractModuleInfo(pdfText) {
    // Parse text to find module metadata
    const moduleMatch = pdfText.match(/Module\s+(?:ID|Name):\s*(.+?)[\n\r]/i);
    const moduleName = moduleMatch?.[1]?.trim();
    
    return {
      module_id: moduleMatch?.[1],
      module_name: moduleName,
      supported_ecus: this.extractSupportedEcus(pdfText)
    };
  }
  
  extractSupportedEcus(pdfText) {
    // Find tables with "Supported ECU List" or similar
    const tableRegex = /ECU Brand.*ECU Model.*Connection.*Status([\s\S]*?)(?=\n\n|\f)/i;
    const tableMatch = pdfText.match(tableRegex);
    
    if (!tableMatch) return [];
    
    const lines = tableMatch[1].split('\n').filter(l => l.trim());
    const ecus = [];
    
    for (const line of lines) {
      const match = line.match(/^\s*([A-Za-z\s]+?)\s+\|\s+(.+?)\s+\|\s+(.+?)\s+\|\s+(.+?)\s*$/);
      if (match) {
        ecus.push({
          ecu_brand: match[1].trim(),
          ecu_model: match[2].trim(),
          connection_method: match[3].trim(),
          support_status: match[4].trim()
        });
      }
    }
    
    return ecus;
  }
  
  async extractFromMultipleModules(pdfDirectory) {
    // Process all PCMFlash manuals in directory
    const pdfs = fs.readdirSync(pdfDirectory).filter(f => f.endsWith('.pdf'));
    const allModules = [];
    
    for (const pdfFile of pdfs) {
      const pdfData = await pdfParse(fs.readFileSync(path.join(pdfDirectory, pdfFile)));
      const moduleInfo = await this.extractModuleInfo(pdfData.text);
      
      // Flatten: each module → each supported ECU becomes a record
      for (const ecu of moduleInfo.supported_ecus) {
        allModules.push({
          ...ecu,
          pcmflash_module_id: moduleInfo.module_id,
          pcmflash_module_name: moduleInfo.module_name,
          source_file: pdfFile
        });
      }
    }
    
    return allModules;
  }
}
```

### Normalization Mapping

```javascript
// PCMFlash PDF → Canonical schema
{
  ecu_brand: canonicalizeEcuBrand(raw.ecu_brand),
  ecu_model: normalizeEcuModel(raw.ecu_model),
  
  // PCMFlash-specific: module + connection
  tuning_tool: 'pcmflash',
  pcmflash_module_id: raw.pcmflash_module_id,
  pcmflash_module_name: raw.pcmflash_module_name,
  
  method: this.inferMethodFromConnection(raw.connection_method),
  protocol: canonicalizeProtocol(raw.connection_method),
  support_level: {
    raw: raw.support_status, // 'Native', 'Adapter', 'Full', 'Limited'
    normalized: normalizePcmflashSupportLevel(raw.support_status)
  },
  
  source_id: 'pcmflash_manual_20260501',
  retrieved_at: new Date(), // when PDF was extracted
  raw_confidence: 0.70, // Official documentation = good, but PDFs not live DB
  
  import_metadata: {
    extraction_method: 'pdf_ocr_table_parsing',
    source_file: raw.source_file,
    pdf_page: raw.pdf_page, // track which page table was on
    extraction_confidence: 0.85 // OCR confidence
  }
}

function inferMethodFromConnection(connectionMethod) {
  const methodMap = {
    'k-line': 'k-line',
    'can': 'can',
    'obd': 'obd',
    'jtag': 'jtag',
    'bdm': 'bdm',
    'bootloader': 'bootloader',
    'adapter': 'adapter' // unknown, needs human classification
  };
  
  const normalized = connectionMethod.toLowerCase();
  for (const [key, method] of Object.entries(methodMap)) {
    if (normalized.includes(key)) {
      return method;
    }
  }
  
  return 'unknown'; // flag for admin review
}
```

### Expected Conflicts vs Local Data

**PCMFlash claims** (from PDF):
- Module BDM-M1000 supports: Bosch EDC16C39, Bosch EDC16CAN

**vs Local sources**:
- AutoTuner: Lists EDC16C39 (tool method unknown)
- DFB: Lists EDC16C39 with "read verified"
- KESS3: Lists EDC16C39 with "full support"

**Reconciliation**:
- PCMFlash clarifies: "needs adapter for CAN variant"
- Evidence grows: EDC16C39 read verified (DFB) + PCMFlash module support
- Conflict note: "(K-Line native, CAN via adapter)" added to evidence

---

## 3. HP Tuners Support Hierarchy Structure

### Source Overview
- **Vendor**: HP Tuners (tuning software)
- **URL pattern**: https://www.hptuners.com/products/supported_vehicles or API
- **Data type**: Vehicle support matrix organized by model year
- **Estimated records**: 5,000+ vehicles, 1990-2025 MY
- **Typical fields**: Brand, model, year, engine, transmission, ECU type, supported tune features

### Expected Web Structure

```html
<!-- HP Tuners vehicle browser -->
<div class="vehicle-browser">
  <select id="brand-select">
    <option value="">Select Brand</option>
    <option value="audi">Audi</option>
    <option value="bmw">BMW</option>
    <!-- ... -->
  </select>
  
  <select id="model-select" disabled>
    <!-- Populated by JavaScript on brand change -->
  </select>
  
  <select id="year-select" disabled>
    <!-- Populated by JavaScript on model change -->
  </select>
  
  <div id="vehicle-info" class="hidden">
    <h3 data-vehicle-name>Audi A4 2020</h3>
    
    <div class="variants">
      <div class="variant" data-variant-id="456">
        <h4>2.0L TFSI (190 HP)</h4>
        <span class="transmission">Manual</span>
        <span class="ecu">Bosch MED17.5</span>
        
        <ul class="tune-features">
          <li class="feature">Power tune</li>
          <li class="feature">Speed limiter disable</li>
          <li class="feature">Top speed increase</li>
          <li class="feature">Launch control</li>
        </ul>
        
        <button class="details-btn" data-variant-id="456">Show Details</button>
      </div>
      
      <!-- More variants -->
    </div>
  </div>
</div>
```

### Data Extraction Strategy

```javascript
class HpTunersWebScraper extends WebScraperConnector {
  async scrapeAllVehicles() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://www.hptuners.com/products/supported_vehicles');
    
    // Get all brands from dropdown
    const brands = await page.evaluate(() => {
      const options = Array.from(document.querySelectorAll('#brand-select option'));
      return options.map(o => ({
        label: o.textContent.trim(),
        value: o.value
      })).filter(b => b.value); // exclude placeholder
    });
    
    const allVehicles = [];
    
    for (const brand of brands) {
      // Select brand
      await page.select('#brand-select', brand.value);
      await page.waitForFunction(() => {
        const modelSelect = document.querySelector('#model-select');
        return modelSelect?.querySelectorAll('option[value]').length > 0;
      });
      
      // Get models for this brand
      const models = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#model-select option[value]'))
          .map(o => ({label: o.textContent.trim(), value: o.value}));
      });
      
      for (const model of models) {
        // Select model
        await page.select('#model-select', model.value);
        await page.waitForFunction(() => {
          const yearSelect = document.querySelector('#year-select');
          return yearSelect?.querySelectorAll('option[value]').length > 0;
        });
        
        // Get years for this model
        const years = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('#year-select option[value]'))
            .map(o => ({label: o.textContent.trim(), value: o.value}));
        });
        
        for (const year of years) {
          // Select year
          await page.select('#year-select', year.value);
          await page.waitForFunction(() => {
            return document.querySelector('.variants .variant') !== null;
          });
          
          // Extract variants for this year
          const variants = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.variants .variant')).map(v => ({
              vehicle_brand: brand.label,
              vehicle_model: model.label,
              vehicle_year: parseInt(year.label),
              engine_size: v.querySelector('h4')?.textContent?.match(/(\d+\.\d+L)/)?.[1],
              engine_fuel: v.querySelector('h4')?.textContent?.toLowerCase().includes('diesel') ? 'diesel' : 'petrol',
              transmission: v.querySelector('.transmission')?.textContent?.trim(),
              ecu: v.querySelector('.ecu')?.textContent?.trim(),
              tune_features: Array.from(v.querySelectorAll('.tune-features .feature'))
                .map(f => f.textContent.trim()),
              variant_id: v.dataset.variantId
            }));
          });
          
          allVehicles.push(...variants);
        }
      }
    }
    
    await browser.close();
    return allVehicles;
  }
}
```

### Normalization Mapping

```javascript
// HP Tuners → Canonical schema
{
  vehicle_brand: canonicalizeVehicleBrand(raw.vehicle_brand),
  vehicle_model: normalizeText(raw.vehicle_model),
  vehicle_year: raw.vehicle_year,
  
  engine_code: raw.engine_size,
  fuel_type: raw.engine_fuel,
  transmission: normalizeTransmission(raw.transmission),
  
  ecu_brand: this.extractEcuBrand(raw.ecu),
  ecu_model: this.extractEcuModel(raw.ecu),
  
  // HP Tuners-specific: tune features supported
  tuning_tool: 'hp_tuners',
  tune_features_supported: raw.tune_features, // array
  
  // Infer method from supported features
  method: this.inferMethodFromFeatures(raw.tune_features),
  
  source_id: 'hp_tuners_portal',
  retrieved_at: new Date(),
  raw_confidence: 0.65, // Third-party tool, less authoritative than vendor
  
  import_metadata: {
    extraction_method: 'web_scraper_dropdown_navigation',
    variant_id: raw.variant_id,
    hp_tuners_vehicle_id: this.generateHpTunersId(raw)
  }
}

function inferMethodFromFeatures(features) {
  // HP Tuners features indicate what the tool can do
  // "Power tune" + "Launch control" = write capable
  // "Speed limiter disable" = flash write capable
  
  const hasWriteFeatures = features.some(f => 
    f.toLowerCase().match(/(power|launch|turbo|speed limiter|rev limiter)/i)
  );
  
  return hasWriteFeatures ? 'bench' : 'obd';
}
```

### Expected Conflicts vs Local Data

**HP Tuners claims**:
- Audi A4 2020 2.0L TFSI: Bosch MED17.5, "power tune + launch control supported"

**vs Local sources**:
- KESS3: Claims "fully supported"
- DFB: Lists MED17.5 with "read verified"
- AutoTuner: Only lists ECU spec (no vehicle context)

**Reconciliation**:
- HP Tuners adds specificity: MED17.5 on 2020 A4 2.0L TFSI
- Clarifies method: "bench write capable" (implied by features)
- Evidence: multiple sources agree on support, HP Tuners adds feature-level detail

---

## Integration Roadmap

### Phase 0C Week 1-2: HP Tuners (Simplest)
- ✅ Build WebScraperConnector for dropdown navigation
- ✅ Handle pagination (brands → models → years)
- ✅ Extract vehicle + tune features
- ✅ Normalize to canonical schema
- ✅ Reconcile with existing data (should have 95%+ overlap with PCMtuner)

### Phase 0C Week 3-4: KESS3 (Moderate)
- ✅ Build WebScraperConnector for table extraction
- ✅ Handle vehicle compatibility table expansion
- ✅ Parse ECU support levels (full/limited/read-only)
- ✅ Reconcile with AutoTuner + DFB overlap
- ✅ Detect conflicts (KESS3 "full" vs DFB "read only")

### Phase 0C Week 5-6: PCMFlash Docs (Complex)
- ✅ Build PdfExtractor with table OCR
- ✅ Batch process all PCMFlash manuals (if available)
- ✅ Parse module ↔ ECU support matrix
- ✅ Map connection methods to protocols
- ✅ Reconcile module support vs tool method claims

---

## Source Quality Metrics

### By Authority
| Source | Authority | Confidence | Notes |
|--------|-----------|-----------|-------|
| AutoTuner portal | Official vendor | 0.75 | Maintained compatibility DB |
| KESS3 portal | Official vendor | 0.75 | Alientech's official support list |
| HP Tuners portal | Official vendor (tool) | 0.65 | Not ECU vendor, but trusted tool |
| PCMFlash docs | Official vendor (module) | 0.70 | Manual, may become outdated |

### By Coverage
| Source | Vehicle Apps | ECU Specs | Methods | Regional |
|--------|--------------|----------|---------|----------|
| AutoTuner | 0 | 767 | ? | Global |
| PCMtuner | 7,076 | 140 inferred | 0 | Global |
| DFB | 0 | 6,128 | 6,128 | Global |
| KESS3 | 15,000+ | inferred | full matrix | Global/EU focus |
| HP Tuners | 5,000+ | inferred | inferred | US focus |
| PCMFlash | 0 | 10,000+ modules | per module | Global |

---

## Architecture Fit

All three online sources fit the same pattern:

```
[Online Source]
    ↓ WebScraperConnector
[Raw HTML/data]
    ↓ normalize() 
[Canonical records with source_id='kess3'|'hp_tuners'|'pcmflash']
    ↓ matchEntities()
[Grouped with existing AutoTuner/PCMtuner/DFB records]
    ↓ detectConflicts()
[Conflict report for admin]
    ↓ linkEvidence()
[Enhanced evidence chains]
    ↓ commit()
[Production tables updated]
```

**Key advantage**: No special cases, same reconciliation logic works for all sources.

---

## Next Steps

After Phase 0B.5 complete:

1. **Week 0C.1**: HP Tuners scraper (should be 95% compatible with AutoTuner/PCMtuner)
2. **Week 0C.2**: KESS3 scraper (will add 5,000+ new vehicle records)
3. **Week 0C.3-4**: PCMFlash extraction (adds module-level ECU support details)
4. **Week 0C.5+**: Monitor for conflicts, refine reconciliation heuristics
5. **Phase 0D**: Add freshness tracking + scheduled sync for monthly updates

The multi-source system will then provide **comprehensive compatibility intelligence** covering 30,000+ vehicle records with 3-5x source triangulation on ECU/method support.
