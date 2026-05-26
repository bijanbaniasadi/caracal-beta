# Entity Relationship Diagram - CaracalTech ECU Intelligence Platform

## Database Schema Structure

### Core Entities (Level 1: Vehicles & Engines)

```
┌─────────────────┐
│    vehicles     │
├─────────────────┤
│ id (UUID, PK)   │
│ make            │
│ model           │
│ year_start      │
│ year_end        │
│ primary_market  │
│ markets (JSON)  │
│ vin_pattern     │
│ is_active       │
│ timestamps      │
└─────────────────┘
        │
        │ 1:M
        ↓
┌─────────────────┐
│    engines      │
├─────────────────┤
│ id (UUID, PK)   │
│ vehicle_id (FK) │
│ engine_code     │
│ displacement_cc │
│ cylinders       │
│ fuel_type       │
│ torque_stock_nm │
│ aspiration      │
│ markets (JSON)  │
│ is_active       │
│ timestamps      │
└─────────────────┘
```

### ECU Hierarchy (Level 2: 3-Level Structure)

```
┌──────────────────────┐
│   ecu_families       │ (Bosch MED17, Siemens MSD80)
├──────────────────────┤
│ id (UUID, PK)        │
│ manufacturer         │
│ family_name          │
│ family_code (UNIQUE) │
│ architecture         │
│ memory_range_kb_*    │
│ processor_type       │
│ timestamps           │
└──────────────────────┘
        │
        │ 1:M
        ↓
┌──────────────────────┐
│   ecu_models         │ (MED17.1, MED17.5.5)
├──────────────────────┤
│ id (UUID, PK)        │
│ ecu_family_id (FK)   │
│ model_designation    │
│ model_code (UNIQUE)  │
│ memory_kb            │
│ processor            │
│ voltage_nominal_mv   │
│ compatible_fw_vers   │
│ markets (JSON)       │
│ timestamps           │
└──────────────────────┘
        │
        │ 1:M
        ↓
┌──────────────────────┐
│ ecu_part_numbers     │ (Actual OEM identifiers)
├──────────────────────┤
│ id (UUID, PK)        │
│ ecu_model_id (FK)    │
│ part_number (UNIQUE) │
│ part_number_type     │
│ alternative_names    │
│ oem_equivalents      │
│ known_revisions      │
│ source_reliability   │
│ timestamps           │
└──────────────────────┘
```

### Vehicle-ECU Mapping

```
┌────────────────────────────────┐
│ vehicle_ecu_applications       │
├────────────────────────────────┤
│ id (UUID, PK)                  │
│ vehicle_id (FK) ────────────→  vehicles
│ engine_id (FK) ────────────→   engines
│ ecu_model_id (FK) ─────────→   ecu_models
│ region (EU/US/CN/GCC/RU/...)   │
│ production_year_start/end      │
│ protocol_primary               │
│ known_part_numbers (JSON)      │
│ confidence_score (0-100)       │
│ verified_by_admin              │
│ timestamps                     │
└────────────────────────────────┘
        │
        │ 1:M
        ├─→ compatibility_evidence (see below)
        └─→ regional_characteristics (see below)
```

### Tuning Tools & Methods

```
┌──────────────────┐
│  tuning_tools    │ (KESS3, Autotuner, Magic, PCMFlash, WinOLS, CMD)
├──────────────────┤
│ id (UUID, PK)    │
│ name (UNIQUE)    │
│ tool_code        │
│ manufacturer     │
│ website          │
│ supported_proto  │
│ supports_boot    │
│ supports_bench   │
│ supports_obd2    │
│ supports_jtag    │
│ timestamps       │
└──────────────────┘
        │
        │ 1:M
        ↓
┌────────────────────────────┐
│ tool_ecu_methods           │ (RELATIONAL - NOT ENUM)
├────────────────────────────┤
│ id (UUID, PK)              │
│ tool_id (FK) ────────────→ tuning_tools
│ ecu_model_id (FK) ────────→ ecu_models
│ method_type (obd2/bench/boot/jtag/...)
│ support_status             │
│ unlock_required            │
│ plugin_required            │
│ plugin_name                │
│ protocol                   │
│ read_speed_kb_sec          │
│ write_speed_kb_sec         │
│ supports_read/write/erase  │
│ confidence_score (0-100)   │
│ verified_by_admin          │
│ UNIQUE: (tool_id, ecu_model_id, method_type)
│ timestamps                 │
└────────────────────────────┘
        │
        │ 1:M
        └─→ compatibility_evidence
```

### Protocol Abstraction

```
┌─────────────────────┐
│ protocol_definitions│ (OBD2, KWP2000, UDS, JTAG, SPI, etc.)
├─────────────────────┤
│ id (UUID, PK)       │
│ protocol_name       │
│ protocol_code       │
│ protocol_category   │
│ default_baud_rate   │
│ supported_baud_*    │
│ pin_configuration   │
│ timestamps          │
└─────────────────────┘
        │
        │ 1:M
        ↓
┌──────────────────────────┐
│ ecu_protocol_profiles    │
├──────────────────────────┤
│ id (UUID, PK)            │
│ ecu_model_id (FK) ─────→ ecu_models
│ protocol_definition_id   │
│ is_primary               │
│ handshake_delay_ms       │
│ timeout_ms               │
│ timing_parameters        │
│ special_requirements     │
│ timestamps               │
└──────────────────────────┘
```

### Compatibility Intelligence

```
┌────────────────────────────────┐
│ compatibility_evidence         │
├────────────────────────────────┤
│ id (UUID, PK)                  │
│ vehicle_ecu_app_id (FK) ─────→ vehicle_ecu_applications
│ tool_ecu_method_id (FK) ─────→ tool_ecu_methods
│ evidence_type (ENUM)           │
│  - official_doc                │
│  - workshop_verified           │
│  - successful_read             │
│  - successful_write            │
│  - community_report            │
│  - bench_test                  │
│  - firmware_analysis           │
│ evidence_weight (0-100)        │
│ evidence_source                │
│ source_id (FK) ─────→ sources  │
│ verified_by_admin              │
│ timestamps                     │
└────────────────────────────────┘
```

### Regional Characteristics (GCC-First)

```
┌───────────────────────────────┐
│ regional_characteristics      │
├───────────────────────────────┤
│ id (UUID, PK)                 │
│ vehicle_ecu_app_id (FK) ────→ vehicle_ecu_applications
│ region (EU/US/CN/GCC/RU...)   │
│ thermal_strategy              │
│ emissions_standard            │
│ catalyst_strategy             │
│ fuel_grade_requirement        │
│ fan_behavior_notes            │
│ regional_ecu_variants (JSON)  │
│ has_export_limitations        │
│ timestamps                    │
└───────────────────────────────┘
```

### Search Aliases (Fuzzy & Regional)

```
┌──────────────────────────────┐
│ search_aliases               │
├──────────────────────────────┤
│ id (UUID, PK)                │
│ alias_type (ENUM)            │
│  - ecu_alias                 │
│  - oem_alias                 │
│  - regional_name             │
│  - fuzzy_support             │
│  - acronym                   │
│ primary_term                 │
│ alias_term                   │
│ target_entity_type           │
│ target_entity_id             │
│ market (GCC-specific, etc.)  │
│ priority                     │
│ timestamps                   │
└──────────────────────────────┘
```

### Source Tracking & Audit

```
┌──────────────────┐
│    sources       │
├──────────────────┤
│ id (UUID, PK)    │
│ name (UNIQUE)    │
│ url              │
│ type (ENUM)      │
│  - official      │
│  - community     │
│  - user          │
│  - academic      │
│  - test          │
│ credibility_*    │
│ timestamps       │
└──────────────────┘
        │
        │ 1:M
        ↓
┌───────────────────┐
│ record_sources    │ (Audit trail for every record)
├───────────────────┤
│ id (UUID, PK)     │
│ record_type       │
│ record_id         │
│ source_id (FK)    │
│ confidence_score  │
│ verified_by_admin │
│ retrieved_at      │
│ timestamps        │
└───────────────────┘
        │
        ↓
┌───────────────────┐
│  audit_logs       │ (Complete change history)
├───────────────────┤
│ id (UUID, PK)     │
│ action            │
│ user_id           │
│ table_name        │
│ record_id         │
│ old_data (JSONB)  │
│ new_data (JSONB)  │
│ change_reason     │
│ ip_address        │
│ timestamps        │
└───────────────────┘
```

### Firmware Intelligence (Future-Proofing)

```
┌──────────────────────────┐
│ firmware_versions        │
├──────────────────────────┤
│ id (UUID, PK)            │
│ ecu_model_id (FK)        │
│ firmware_version         │
│ firmware_hash_*          │
│ firmware_size_kb         │
│ release_date             │
│ timestamps               │
└──────────────────────────┘

┌──────────────────────────┐
│ software_versions        │
├──────────────────────────┤
│ id (UUID, PK)            │
│ ecu_model_id (FK)        │
│ software_version_string  │
│ calibration_id           │
│ supported_fw_versions    │
│ timestamps               │
└──────────────────────────┘

┌──────────────────────────┐
│ hardware_versions        │
├──────────────────────────┤
│ id (UUID, PK)            │
│ ecu_family_id (FK)       │
│ pcb_revision             │
│ component_variant        │
│ compatible_ecu_models    │
│ timestamps               │
└──────────────────────────┘

┌──────────────────────────┐
│ checksum_profiles        │
├──────────────────────────┤
│ id (UUID, PK)            │
│ ecu_model_id (FK)        │
│ checksum_algorithm       │
│ seed_value               │
│ polynomial               │
│ checksum_offset          │
│ timestamps               │
└──────────────────────────┘

┌──────────────────────────┐
│ protocol_profiles        │
├──────────────────────────┤
│ id (UUID, PK)            │
│ ecu_model_id (FK)        │
│ protocol_type            │
│ baud_rate                │
│ timeout_ms               │
│ init_sequence            │
│ seed_key_algorithm       │
│ timestamps               │
└──────────────────────────┘

┌──────────────────────────┐
│ mcu_profiles             │
├──────────────────────────┤
│ id (UUID, PK)            │
│ ecu_family_id (FK)       │
│ mcu_type                 │
│ architecture             │
│ instruction_set          │
│ clock_speed_mhz          │
│ flash/ram/eeprom_size_kb │
│ timestamps               │
└──────────────────────────┘

┌──────────────────────────┐
│ memory_layouts           │
├──────────────────────────┤
│ id (UUID, PK)            │
│ ecu_model_id (FK)        │
│ region_name              │
│ start_address_hex        │
│ size_bytes               │
│ is_writable              │
│ requires_unlock          │
│ timestamps               │
└──────────────────────────┘
```

### Import Pipeline (Staging & Validation)

```
┌────────────────────────────┐
│ import_batches             │
├────────────────────────────┤
│ id (UUID, PK)              │
│ source_id (FK)             │
│ batch_status (ENUM)        │
│  - pending                 │
│  - validating              │
│  - valid                   │
│  - invalid                 │
│  - conflicted              │
│  - staged                  │
│  - committed               │
│  - failed                  │
│ total_records              │
│ valid_records              │
│ invalid_records            │
│ conflict_records           │
│ validation_summary         │
│ user_id                    │
│ validated_at               │
│ committed_at               │
│ timestamps                 │
└────────────────────────────┘
        │
        │ 1:M
        ↓
┌────────────────────────────┐
│ import_staging             │
├────────────────────────────┤
│ id (UUID, PK)              │
│ import_batch_id (FK)       │
│ table_name (ENUM)          │
│ raw_data (JSONB)           │
│ validation_status (ENUM)   │
│  - pending                 │
│  - valid                   │
│  - invalid                 │
│  - conflict                │
│ validation_errors (JSON)   │
│ conflict_data (JSONB)      │
│ conflict_type              │
│ existing_record_id         │
│ similarity_score (0-100)   │
│ sequence_number            │
│ timestamps                 │
└────────────────────────────┘
        │
        │ 1:M (if conflicted)
        ↓
┌────────────────────────────┐
│ import_conflicts           │
├────────────────────────────┤
│ id (UUID, PK)              │
│ import_staging_id (FK)     │
│ existing_record_id         │
│ conflict_type (ENUM)       │
│  - duplicate               │
│  - similar                 │
│  - reference_mismatch      │
│  - data_divergence         │
│ confidence_match (0-100)   │
│ incoming_data (JSONB)      │
│ existing_data (JSONB)      │
│ resolution_status (ENUM)   │
│  - unresolved              │
│  - merge                   │
│  - keep_existing           │
│  - use_incoming            │
│  - manual_review           │
│ resolved_by_user_id        │
│ resolution_notes           │
│ timestamps                 │
└────────────────────────────┘
```

## Key Design Principles

### 1. **Three-Level ECU Hierarchy**
- **Families**: Manufacturer + architecture (Bosch MED17)
- **Models**: Specific version (MED17.1, MED17.5.5)
- **Part Numbers**: Actual OEM identifiers (specific part_number)
- **Benefit**: Scales for firmware intelligence, allows partial matching, supports variants

### 2. **Relational Compatibility Model**
- One ECU can support OBD2, bench, and JTAG
- Each method has different constraints (unlock, plugin, protocol)
- Grows cleanly when tools add new methods
- Eliminates fragile ENUM patterns

### 3. **Source Tracking on Every Record**
- `record_sources` table links every data point to its source
- Confidence score computed from source credibility + evidence type + verification count
- Audit log captures all changes (old_data, new_data, change_reason)
- Enables data quality governance

### 4. **Confidence Scoring System**
- 0-100 on every vehicle-ECU mapping and tool-method relationship
- Drives sorting in search results
- Admin verification required for > 80
- Transparency on data reliability

### 5. **GCC-First Regional Awareness**
- Market explicitly modeled at multiple levels
- Regional characteristics capture emissions, thermal, fuel, fan behavior
- Aliases support regional names (e.g., "Mercedes-Benz E-Klasse CDI" for EU)
- Export limitations tracked per region

### 6. **Future-Proof Firmware Intelligence**
- firmware_versions, software_versions, hardware_versions tables
- checksum_profiles, protocol_profiles, mcu_profiles, memory_layouts
- Empty at MVP but structure in place
- Prevents schema migration pain when firmware features launch

### 7. **Safe Import Pipeline**
- CSV → staging → validation → conflict detection → admin review → commit
- No direct inserts to production tables
- Dry-run mode for preview
- Conflict resolution workflow before commit
- Reindex Typesense only after commit

## Indexing Strategy

**Indexes on all foreign keys** (ensures join performance):
- vehicle_id, engine_id, ecu_model_id in all child tables
- tool_id, source_id in relationship tables

**Indexes on search columns**:
- vehicles: make, model, year_start/end, primary_market
- engines: engine_code, fuel_type, displacement_cc
- ecu_models: model_code, memory_kb
- ecu_part_numbers: part_number, part_number_type
- tuning_tools: tool_code, name
- tool_ecu_methods: method_type, support_status

**Indexes on filtering columns**:
- vehicle_ecu_applications: region, confidence_score, is_active
- tool_ecu_methods: support_status
- sources: type, credibility_score
- record_sources: record_type, confidence_score
- audit_logs: table_name, action, user_id, created_at

## Data Integrity

**Constraints**:
- All primary keys are UUID (immutable, globally unique)
- All foreign keys have indexes and cascade delete/update as appropriate
- Unique constraints on: part_number, part_number_code, source.name, tool.tool_code
- Check constraints on confidence_score (0-100), evidence_weight (0-100)
- Created/updated timestamps on all tables

**Referential Integrity**:
- Deleting vehicle cascades to engines, vehicle_ecu_applications
- Deleting ecu_family cascades to ecu_models
- Deleting ecu_model cascades to ecu_part_numbers
- Deleting source RESTRICTS deletion if records depend on it (prevents accidental loss)

## Performance Considerations

**Query Patterns**:
- VIN → vehicle candidates (vehicles table, indexed on make/model/year/vin_pattern)
- Part number → ECU + tools (ecu_part_numbers → ecu_models → tool_ecu_methods, indexed)
- Vehicle + year → compatible tools (vehicle_ecu_applications + tool_ecu_methods, indexed on confidence)

**Typesense Projection**:
- Full-text index on: vehicle.make + model, engine.code, ecu_family.family_name, ecu_models.model_code, ecu_part_numbers.part_number + alternatives
- Alias index for fuzzy/regional matching

**Partitioning Strategy (Future)**:
- Consider partitioning import_staging, audit_logs by created_at (monthly)
- Partitioning compatibility_evidence by region for GCC-specific queries
