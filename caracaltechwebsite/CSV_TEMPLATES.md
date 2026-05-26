# CSV Import Templates

All CSV files should use UTF-8 encoding with CRLF line endings.

## 1. vehicles.csv

Required columns for vehicle registry.

```csv
make,model,year_start,year_end,primary_market,markets,vin_pattern,notes
Mercedes-Benz,E-Class,2016,2020,EU,"[""EU"",""GCC""]",WDB,E-Class W213 platform
BMW,3-Series,2017,2021,EU,"[""EU"",""US""]",WBADT,F30/F31 generation
Audi,A4,2015,2019,EU,"[""EU"",""GCC""]",WAUXY,B9 generation
Ford,Focus,2014,2018,EU,"[""EU"",""US""]",WF0,MK3 generation
```

### Column Definitions

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| make | string (100) | ✓ | Vehicle manufacturer (e.g., Mercedes-Benz, BMW) |
| model | string (150) | ✓ | Model name (e.g., E-Class, 3-Series) |
| year_start | integer | ✓ | Production start year (1900-2100) |
| year_end | integer | ✓ | Production end year (1900-2100) |
| primary_market | enum | ✓ | Primary market: EU, US, CN, GCC, RU, AU, JP |
| markets | json array | ✓ | Available markets: ["EU", "US", "CN", "GCC", "RU", "AU", "JP"] |
| vin_pattern | string (500) | | WMI pattern for VIN matching (e.g., WDB, WBADT) |
| notes | text | | Additional notes (e.g., generation, platform code) |

---

## 2. engines.csv

Engine specifications linked to vehicles.

```csv
vehicle_id,engine_code,engine_name,displacement_cc,cylinders,horsepower_stock,torque_stock_nm,fuel_type,fuel_grade,aspiration,markets,notes
<uuid>,M256E30,2.0L Turbo,1991,4,258,370,petrol,RON95,turbocharged,"[""EU"",""GCC""]",E-Class W213 AMG Sport
<uuid>,OM654A,2.0L Diesel,1950,4,163,380,diesel,diesel,turbocharged,"[""EU"",""GCC""]",E-Class W213 CDI
<uuid>,M256E25,2.0L Turbo,1991,4,211,320,petrol,RON95,turbocharged,"[""EU""]",E-Class W213 base
<uuid>,M137E55,3.0L Twin-Turbo,2999,6,429,520,petrol,premium,turbocharged,"[""EU"",""US""]",E-Class W213 AMG
```

### Column Definitions

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| vehicle_id | uuid | ✓ | Foreign key to vehicles.id |
| engine_code | string (50) | ✓ | Engine code (e.g., M256E30, OM654A) |
| engine_name | string (200) | | Display name (e.g., "2.0L Turbo 4-Cylinder") |
| displacement_cc | integer | ✓ | Engine displacement in cc (e.g., 1991) |
| cylinders | integer | ✓ | Number of cylinders (3-16) |
| horsepower_stock | integer | ✓ | Stock power output in PS/HP |
| torque_stock_nm | integer | ✓ | Stock torque in Nm |
| fuel_type | enum | ✓ | petrol, diesel, hybrid, electric, lpg, cng |
| fuel_grade | enum | | RON91, RON95, RON98, diesel, premium |
| aspiration | string (50) | | naturally-aspirated, turbocharged, supercharged, twin-turbo |
| markets | json array | | Regional availability: ["EU", "US", "CN", "GCC", "RU", "AU", "JP"] |
| notes | text | | Generation, OBD system, emissions standard |

---

## 3. ecu_families.csv

Top-level ECU family definitions.

```csv
manufacturer,family_name,family_code,architecture,memory_range_kb_min,memory_range_kb_max,processor_type,description,supports_boot_mode,supports_bench_mode,supports_obd2,supports_jtag,notes
Bosch,Motronic ME17.1,ME17.1,PowerPC,1024,2048,MPC560P5,Motronic ME17.1 turbo engines,true,true,false,false,European market
Siemens,Micronas MSD80,MSD80,ARM,512,1024,ARM7TDI,MSD80 for turbocharged engines,true,true,false,true,Audi/VW turbo applications
Delphi,Multec,MULTEC,x86,256,512,Intel 386,Older generation ECUs,true,true,false,false,Legacy support
```

### Column Definitions

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| manufacturer | string (100) | ✓ | Manufacturer (Bosch, Siemens, Delphi, etc.) |
| family_name | string (150) | ✓ | Full family name (e.g., "Motronic ME17.1") |
| family_code | string (50) | ✓ | Unique code (e.g., "ME17.1", "MSD80") |
| architecture | enum | ✓ | PowerPC, ARM, x86, AVR, HCS12, unknown |
| memory_range_kb_min | integer | ✓ | Minimum memory in KB |
| memory_range_kb_max | integer | ✓ | Maximum memory in KB |
| processor_type | string (150) | | Processor model (e.g., "MPC560P5") |
| description | text | | Detailed description |
| supports_boot_mode | boolean | ✓ | true/false |
| supports_bench_mode | boolean | ✓ | true/false |
| supports_obd2 | boolean | ✓ | true/false |
| supports_jtag | boolean | ✓ | true/false |
| notes | text | | Application notes |

---

## 4. ecu_models.csv

Middle-level ECU model definitions.

```csv
ecu_family_id,model_designation,model_code,memory_kb,processor,voltage_nominal_mv,markets,compatible_firmware_versions,description,notes
<uuid>,MED17.1,MED17.1,1024,MPC560P5,5000,"[""EU"",""GCC""]","[""1.0"",""1.1"",""1.2""]",Motronic ME17.1 variant 1,Boot and bench supported
<uuid>,MED17.5.5,MED17.5.5,2048,MPC560P5,5000,"[""EU""]","[""2.0"",""2.1""]",Enhanced MED17.5.5 variant,Recent generation
<uuid>,MSD80.5,MSD80.5,1024,ARM7TDI,3300,"[""EU"",""US""]","[""3.0"",""3.1""]",MSD80 variant 5,Turbo applications
```

### Column Definitions

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| ecu_family_id | uuid | ✓ | Foreign key to ecu_families.id |
| model_designation | string (100) | ✓ | Model designation (e.g., "MED17.1") |
| model_code | string (50) | ✓ | Unique code across all ECUs |
| memory_kb | integer | ✓ | Total memory in KB |
| processor | string (150) | ✓ | Processor variant |
| voltage_nominal_mv | integer | ✓ | Nominal voltage in mV (5000 = 5V, 3300 = 3.3V) |
| markets | json array | | ["EU", "US", "CN", "GCC", "RU", "AU", "JP"] |
| compatible_firmware_versions | json array | | Array of supported firmware versions: ["1.0", "1.1", "2.0"] |
| description | text | | Detailed description |
| notes | text | | Implementation notes |

---

## 5. ecu_part_numbers.csv

Actual OEM part number registry.

```csv
ecu_model_id,part_number,part_number_type,alternative_names,oem_equivalents,manufacturer_part,service_notes,known_revisions,source_reliability
<uuid>,A6229061800,OEM,"[""6229061800"",""622-906-1800""]","[""0261S20065""]",BOSCH_6229061800,Can be reprogrammed,"{""HW"": [""1.0"",""2.0""], ""SW"": [""3.14"",""3.15""]}",official
<uuid>,0261S20065,SERVICE,"[""261S20065""]","[""6229061800""]",SIEMENS_S20065,Service replacement,"{""HW"": [""1.0""],""SW"": [""3.14""]}",verified
<uuid>,616629010480,CHINESE,,"[""A6229061800""]",CLONE_616629010480,May not be compatible with all tuning tools,,unverified
```

### Column Definitions

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| ecu_model_id | uuid | ✓ | Foreign key to ecu_models.id |
| part_number | string (100) | ✓ | Unique part number |
| part_number_type | string (50) | ✓ | OEM, service, software_id, chinese_clone, etc. |
| alternative_names | json array | | ["6229061800", "622-906-1800"] |
| oem_equivalents | json array | | Cross-references: ["0261S20065"] |
| manufacturer_part | string (100) | | Original manufacturer identifier |
| service_notes | text | | Programming, compatibility, warnings |
| known_revisions | json object | | {"HW": ["1.0", "2.0"], "SW": ["3.14", "3.15"]} |
| source_reliability | enum | ✓ | official, verified, community, unverified |

---

## 6. vehicle_ecu_applications.csv

Maps vehicles to ECU models per region.

```csv
vehicle_id,engine_id,ecu_model_id,region,production_year_start,production_year_end,protocol_primary,known_part_numbers,confidence_score,verified_by_admin,notes
<uuid>,<uuid>,<uuid>,EU,2016,2020,OBD2,"[""A6229061800"",""0261S20065""]",85,true,E-Class W213 EU 2016-2020 model
<uuid>,<uuid>,<uuid>,GCC,2016,2020,OBD2,"[""A6229061800""]",75,false,GCC variant with slightly different emissions calibration
<uuid>,<uuid>,<uuid>,US,2017,2019,OBD2,"[""0261S20065""]",65,false,US market variant - Limited data
```

### Column Definitions

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| vehicle_id | uuid | ✓ | Foreign key to vehicles.id |
| engine_id | uuid | ✓ | Foreign key to engines.id |
| ecu_model_id | uuid | ✓ | Foreign key to ecu_models.id (NOT part_numbers) |
| region | enum | ✓ | EU, US, CN, GCC, RU, AU, JP |
| production_year_start | integer | ✓ | Start production year |
| production_year_end | integer | ✓ | End production year |
| protocol_primary | string (50) | | OBD2, bootloader, JTAG, etc. |
| known_part_numbers | json array | | Known part numbers for this application: ["A6229061800", "0261S20065"] |
| confidence_score | integer | ✓ | 0-100, based on source credibility and evidence |
| verified_by_admin | boolean | ✓ | true/false |
| notes | text | | Region-specific notes, emissions standard, calibration variant |

---

## 7. tool_ecu_methods.csv

Maps tuning tools to ECU models with method-specific constraints.

```csv
tool_id,ecu_model_id,method_type,support_status,unlock_required,plugin_required,plugin_name,protocol,read_speed_kb_sec,write_speed_kb_sec,supports_read,supports_write,supports_erase,confidence_score,verified_by_admin,notes
<uuid>,<uuid>,obd2,full,false,false,,KWP2000,512,256,true,true,false,90,true,Full OBD2 support via K-Line
<uuid>,<uuid>,bench,partial,true,true,KESS3_Bench_Plugin,OBD2,1024,512,true,true,true,75,true,Requires bench mode adapter
<uuid>,<uuid>,boot,reported,false,false,,Custom,512,512,true,true,true,45,false,Community reports only - unverified
<uuid>,<uuid>,jtag,unsupported,false,false,,JTAG,,false,false,false,10,false,Not supported by this tool
```

### Column Definitions

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| tool_id | uuid | ✓ | Foreign key to tuning_tools.id |
| ecu_model_id | uuid | ✓ | Foreign key to ecu_models.id |
| method_type | enum | ✓ | obd2, bench, boot, jtag, virtual_read, can_kickdown, custom |
| support_status | enum | ✓ | full, partial, reported, unsupported |
| unlock_required | boolean | ✓ | true/false |
| plugin_required | boolean | ✓ | true/false |
| plugin_name | string (150) | | Name of required plugin (if plugin_required=true) |
| protocol | string (100) | | OBD2, KWP2000, UDS, JTAG, SPI, custom |
| read_speed_kb_sec | integer | | Typical read speed in KB/sec |
| write_speed_kb_sec | integer | | Typical write speed in KB/sec |
| supports_read | boolean | ✓ | true/false |
| supports_write | boolean | ✓ | true/false |
| supports_erase | boolean | ✓ | true/false |
| confidence_score | integer | ✓ | 0-100 based on source credibility |
| verified_by_admin | boolean | ✓ | true/false |
| notes | text | | Method-specific notes, caveats, workarounds |

---

## Import Instructions

### Via Admin UI

1. Navigate to Admin → Import → Upload CSV
2. Select the CSV file
3. System validates schema and preview
4. Review validation results
5. Resolve any conflicts
6. Commit batch

### Via API (Future)

```bash
curl -X POST http://localhost:3000/api/admin/import/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@vehicles.csv" \
  -F "table=vehicles" \
  -F "source_id=<uuid>"
```

### CSV Format Requirements

- **Encoding**: UTF-8
- **Line endings**: CRLF (\r\n)
- **Delimiter**: Comma (,)
- **String quotes**: Double quotes (")
- **Escaping**: Double quotes escaped as "" inside quoted fields
- **JSON arrays**: Encoded as string inside quotes, e.g., "[""EU"",""US""]"
- **NULL values**: Leave empty (no value between commas)
- **Dates**: ISO 8601 format (YYYY-MM-DD)
- **UUIDs**: Valid UUID v4 format

### Validation Rules

- **Required fields**: Cannot be empty
- **UUID fields**: Must be valid v4 UUIDs or will be marked as invalid
- **Enum fields**: Must match whitelist (case-sensitive)
- **Integer fields**: Must be numeric without commas or currency symbols
- **String fields**: Trimmed of leading/trailing whitespace
- **Foreign keys**: Must exist in referenced table
- **Unique fields**: part_number, model_code, family_code must not duplicate in batch or production

### Error Handling

If validation fails:
1. System reports line number and field name
2. Error description explains the issue
3. Admin can edit raw CSV or delete problematic rows
4. Re-validate and resubmit

### Best Practices

1. **Start small**: Import 5-10 vehicles first to validate your CSV format
2. **Use templates**: Don't create CSVs from scratch; copy templates and fill in
3. **Test locally**: Validate CSV in spreadsheet app before uploading
4. **Document sources**: Add notes field explaining data source (KESS3, community, etc.)
5. **Set confidence correctly**: Be honest about confidence scores (80+ = very high confidence)
6. **Link part numbers**: For vehicle_ecu_applications, list actual part numbers used
7. **Regional variants**: Create separate rows per region if specs differ

### Example Workflow

```
1. Create vehicles.csv with target vehicles (10 rows)
   └─ Upload and validate (should be 100% valid)

2. Create engines.csv linked to vehicle IDs from step 1 (15 rows)
   └─ Upload and validate (foreign keys should resolve)

3. Create ecu_models.csv from data sources (5 rows)
   └─ Upload and validate (no conflicts expected)

4. Create vehicle_ecu_applications.csv (20 rows = vehicles × regions)
   └─ Upload, review confidence scores
   └─ Commit batch 1-4 together for consistency

5. Create tool_ecu_methods.csv (30-50 rows = tools × ecu_models × methods)
   └─ Upload, resolve any conflicts
   └─ Verify tool availability with source data
   └─ Commit batch 5
```

This phased approach ensures data consistency and makes debugging easier.
