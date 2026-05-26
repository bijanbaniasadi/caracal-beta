# CaracalTech ECU Intelligence Platform

A production-grade automotive ECU compatibility intelligence platform designed for workshops, tuners, and ECU developers. Powered by PostgreSQL, Node.js/Express, and Typesense, with a focus on data quality, source tracking, and GCC-market awareness.

## Architecture Overview

### Data Foundation (PostgreSQL)
- **12+ normalized migration files** with UUID primary keys and comprehensive indexing
- **Source-tracked audit system** for all data modifications
- **Relational compatibility model** (one ECU supports multiple tools with different constraints)
- **3-level ECU hierarchy**: families → models → part_numbers
- **Firmware intelligence placeholders** for future enhancement (firmware_versions, software_versions, hardware_versions, checksum_profiles, protocol_profiles, mcu_profiles, memory_layouts)
- **Regional characteristics system** for GCC, EU, US, CN, RU, AU, JP market-specific variants
- **Compatibility evidence system** with 7 evidence types (official_doc, workshop_verified, successful_read, successful_write, community_report, bench_test, firmware_analysis)

### Search & Discovery (Typesense)
- Fuzzy matching with typo tolerance
- Alias support for regional names and OEM equivalents
- Full-text search across all ECU/vehicle/tool metadata
- Real-time indexing from PostgreSQL

### Import Pipeline (Staging & Validation)
- CSV → staging table → validation → conflict detection → admin review → commit → reindex
- Deduplication logic with similarity scoring (0-100)
- Confidence scoring on all records
- Conflict resolution workflow for divergent data sources
- Dry-run mode for safe preview before commit

### API Layer (Express.js)
- VIN search returning candidates with confidence scores
- ECU part number search (exact + fuzzy)
- Vehicle dropdown/search
- Tool-ECU method compatibility matrix
- Admin endpoints for import, verification, audit logs

### Admin Panel (React + Vite)
- Secured CSV import interface with preview
- Record editor for vehicles, engines, ECUs, tool methods
- Verification workflow (flag records, update confidence)
- Audit log viewer with filtering
- Conflict resolution interface

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Database** | PostgreSQL 15 | Source of truth, ACID compliance |
| **ORM/Migrations** | Knex.js | Schema version control, safe migrations |
| **Backend** | Express.js | REST API, admin endpoints |
| **Search** | Typesense | Full-text search, fuzzy matching |
| **Frontend** | React + Vite | Admin UI, user search interface |
| **Styling** | Tailwind CSS | Responsive UI components |
| **Containerization** | Docker Compose | Local dev environment, consistent setup |
| **Process Management** | PM2 | Production process management (Phase 1+) |

## Quick Start

### Prerequisites
- Docker & Docker Compose (recommended)
- Node.js 18+ (for local development without Docker)
- npm 9+

### Local Development (Docker)

1. **Clone and setup**:
```bash
git clone <repo>
cd caracaltech-ecu-intelligence
cp .env.example .env
```

2. **Start services**:
```bash
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Typesense (port 8108)
- Express API (port 3000)
- Migrations run automatically on startup

3. **Verify**:
```bash
curl http://localhost:3000/health
curl http://localhost:8108/health
```

### Local Development (Without Docker)

1. **Install PostgreSQL**:
```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# Start service
brew services start postgresql  # macOS
sudo systemctl start postgresql  # Linux
```

2. **Create database**:
```bash
psql -U postgres
CREATE USER caracaltech WITH PASSWORD 'caracaltech_dev_password';
CREATE DATABASE caracaltech_ecu OWNER caracaltech;
GRANT ALL PRIVILEGES ON DATABASE caracaltech_ecu TO caracaltech;
\q
```

3. **Install dependencies**:
```bash
npm install
```

4. **Run migrations**:
```bash
npm run migrate
```

5. **Start Typesense** (separate terminal):
```bash
docker run -p 8108:8108 typesense/typesense --api-key=caracaltech_typesense_key_dev
```

6. **Start API**:
```bash
npm run dev
```

API available at `http://localhost:3000`

## Database Schema

### Core Tables

**vehicles** - Make, model, year range, primary market, VIN pattern
- Indexed on: make, model, year_start/end, primary_market

**engines** - Engine code, displacement, cylinders, horsepower, torque, fuel type
- Foreign key: vehicles.id
- Indexed on: vehicle_id, engine_code, fuel_type, displacement_cc

**ecu_families** - Bosch MED17, Siemens MSD80, etc. (TOP LEVEL)
- Indexed on: manufacturer, family_code, architecture

**ecu_models** - MED17.1, MED17.5.5, etc. (MIDDLE LEVEL)
- Foreign key: ecu_families.id
- Indexed on: ecu_family_id, model_code, memory_kb

**ecu_part_numbers** - Actual part identifiers (BOTTOM LEVEL)
- Foreign key: ecu_models.id
- Indexed on: ecu_model_id, part_number, part_number_type

**vehicle_ecu_applications** - Mapping of vehicles to ECU models by region
- Foreign keys: vehicles.id, engines.id, ecu_models.id
- Indexed on: vehicle_id, ecu_model_id, region, confidence_score

**tuning_tools** - KESS3, Autotuner, Magic Motorsport, PCMFlash, WinOLS, CMD
- Indexed on: tool_code, name

**tool_ecu_methods** - RELATIONAL (not ENUM): One ECU supports multiple tools/methods
- Foreign keys: tuning_tools.id, ecu_models.id
- Indexed on: tool_id, ecu_model_id, method_type, support_status

### Intelligence Tables

**protocol_definitions** - OBD2, KWP2000, UDS, JTAG, SPI, etc.
**ecu_protocol_profiles** - Protocol config per ECU (baud, timing, seed/key)

**compatibility_evidence** - Evidence types: official_doc, workshop_verified, successful_read/write, bench_test, firmware_analysis
- Foreign keys: vehicle_ecu_applications.id, tool_ecu_methods.id, sources.id

**search_aliases** - Fuzzy matching support
- Types: ecu_alias, oem_alias, regional_name, fuzzy_support, acronym
- Supports market-specific variants (GCC, EU, CN, etc.)

**regional_characteristics** - Market-specific ECU variants
- thermal_strategy, emissions_standard, catalyst_strategy, fuel_grade_requirement, fan_behavior

### Firmware Intelligence (Placeholders)

**firmware_versions** - Firmware version, hash, size, release date
**software_versions** - Software version string, calibration ID
**hardware_versions** - PCB revision, component variants
**checksum_profiles** - Checksum algorithm, seed, polynomial
**protocol_profiles** - Protocol baud rate, timing, seed/key algorithm
**mcu_profiles** - MCU type, architecture, memory specs
**memory_layouts** - Memory regions (bootloader, kernel, calibration, etc.)

### Source Tracking & Audit

**sources** - Data source registry (official, community, user, academic, test)
- Credibility score (0-100)

**record_sources** - Audit trail linking records to sources
- Foreign key: sources.id
- Indexed on: record_type, record_id, source_id, confidence_score

**audit_logs** - All changes with old/new data
- Indexed on: table_name, record_id, action, user_id, created_at

### Import Pipeline

**import_batches** - Batch-level status and summary
- Status: pending, validating, valid, invalid, conflicted, staged, committed, failed

**import_staging** - Per-record staging area
- validation_status: pending, valid, invalid, conflict
- Stores raw_data, validation_errors, conflict_data

**import_conflicts** - Conflict resolution workflow
- conflict_type: duplicate, similar, reference_mismatch, data_divergence
- resolution_status: unresolved, merge, keep_existing, use_incoming, manual_review

## Import Pipeline Flow

```
CSV File Upload
    ↓
Parse & Validate Schema
    ↓
Create Import Batch (pending)
    ↓
Load into import_staging (validation_status=pending)
    ↓
Validate Each Record
    ├─ Field type validation
    ├─ Foreign key references
    ├─ Duplicate detection
    ├─ Similarity matching (0-100)
    └─ Store errors/conflicts
    ↓
Batch Status = Validated
    ├─ valid_records count
    ├─ invalid_records count
    └─ conflict_records count
    ↓
Admin Review Interface
    ├─ Browse records
    ├─ Review validation errors
    ├─ Resolve conflicts
    ├─ Update confidence scores
    └─ Choose resolution per conflict
    ↓
Admin Commits Batch
    ├─ Transfer to production tables
    ├─ Create record_sources entries
    ├─ Log audit entries
    ├─ Reindex Typesense
    └─ Mark import_batch = committed
    ↓
Available in API & Search
```

## Confidence Scoring Design

Confidence score (0-100) on every record indicates data reliability:

- **90-100**: Multiple official sources (KESS3, Autotuner official docs, bench-verified)
- **70-89**: Community consensus (3+ independent reports) + one official
- **50-69**: Single community source or unverified official
- **30-49**: Conflicting reports or partial verification
- **0-29**: User-reported, unverified, or deprecated

**Calculation**:
```
confidence = (
  (source_credibility_score * 0.5) +
  (evidence_type_weight * 0.3) +
  (verification_count * 0.2) +
  (admin_verification ? +10 : 0)
) / scaling_factor
```

Evidence weights:
- official_doc: 100
- workshop_verified: 85
- bench_test: 80
- firmware_analysis: 75
- successful_read/write: 60
- community_report: 40

## CSV Import Templates

### vehicles.csv
```csv
make,model,year_start,year_end,primary_market,markets,vin_pattern,notes
Mercedes-Benz,E-Class,2016,2020,EU,"[""EU"",""GCC""]","WDB2*1*",Sport edition
BMW,3 Series,2017,2019,EU,"[""EU"",""US""]","WBADT*",Base model
```

### ecu_models.csv
```csv
ecu_family_id,model_designation,model_code,memory_kb,processor,voltage_nominal_mv,markets,notes
<uuid>,MED17.1,MED17.1,2048,MPC560P5,5000,"[""EU""]",Boot mode supported
```

### vehicle_ecu_applications.csv
```csv
vehicle_id,engine_id,ecu_model_id,region,production_year_start,production_year_end,protocol_primary,confidence_score,verified_by_admin
<uuid>,<uuid>,<uuid>,EU,2016,2020,OBD2,75,false
```

### tool_ecu_methods.csv
```csv
tool_id,ecu_model_id,method_type,support_status,unlock_required,plugin_required,protocol,confidence_score,verified_by_admin
<uuid>,<uuid>,obd2,full,false,false,KWP2000,85,true
<uuid>,<uuid>,bench,partial,true,false,OBD2,65,false
```

## API Endpoints (Phase 0B Implementation)

### Search Endpoints

**GET /api/search/vin**
```json
{
  "vin": "WDBEFT12345678901",
  "includeConfidence": true
}
// Returns: { candidates: [{vehicle, engines, possible_ecus_with_confidence}] }
```

**GET /api/search/part-number**
```json
{
  "partNumber": "ME17.1",
  "fuzzy": true
}
// Returns: { results: [{ecu_model, compatible_vehicles, tools_supported}] }
```

**GET /api/search/vehicle**
```json
{
  "make": "Mercedes",
  "model": "E-Class",
  "year": 2018
}
// Returns: { vehicles: [{id, engines, ecu_applications}] }
```

### Admin Endpoints

**POST /api/admin/import/upload**
- Upload CSV file
- Returns import_batch_id

**GET /api/admin/import/{batchId}/preview**
- Preview records before commit
- Show validation errors and conflicts

**POST /api/admin/import/{batchId}/resolve-conflicts**
- Accept/reject conflicts
- Provide resolution strategy per conflict

**POST /api/admin/import/{batchId}/commit**
- Commit batch to production
- Reindex Typesense

**GET /api/admin/audit-log**
- Filter by table, record, action, user
- View all changes with before/after data

## Environment Variables

See `.env.example` for all available options. Key variables:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=caracaltech
DB_PASSWORD=...
DB_NAME=caracaltech_ecu

# Typesense
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_API_KEY=...

# Admin Auth
JWT_SECRET=...
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=...

# Import
MAX_IMPORT_BATCH_SIZE=5000
MAX_FILE_SIZE_MB=100
```

## Development Workflow

### Adding a New Migration

```bash
npm run migrate:make create_new_table_name
# Edit migrations/<timestamp>_create_new_table_name.js
npm run migrate
```

### Testing Schema

```bash
# Rollback one step
npm run migrate:rollback

# Rollback all
npm run migrate:rollback --all

# Re-migrate
npm run migrate
```

### Running Tests

```bash
npm test
npm test -- --watch
```

## Production Deployment (Phase 2)

1. **Database**: Managed PostgreSQL service (AWS RDS, Azure Database, etc.)
2. **Typesense**: Self-hosted or Typesense Cloud
3. **API**: Node.js with PM2 on VPS
4. **Frontend**: Static build deployed to CDN
5. **Monitoring**: ELK stack or Datadog

## Data Quality & Governance

- All records have source_id and confidence_score
- Admin verification required for confidence > 80
- Monthly audit log review
- Conflict resolution SLA: 48 hours
- Data deprecation: Records not verified for 6 months marked as inactive

## Roadmap

- **Phase 0A** (Current): Schema & migrations ✓
- **Phase 0B**: Import pipeline + API
- **Phase 0C**: Admin panel
- **Phase 0D**: Frontend search interface
- **Phase 0E**: Docker Compose + local dev
- **Phase 1**: MVP data collection (100-300 vehicles)
- **Phase 2**: VPS deployment
- **Phase 3**: Beta testing & refinement
- **Phase 4**: Public launch
- **Phase 5**: Dataset expansion (5000+)

## License

PROPRIETARY - CaracalTech Motors

## Support

For technical questions or issues:
1. Check existing migrations and schema
2. Review audit_logs for data state
3. Run validation on import batches
4. Contact: development@caracaltech.local
