# Phase 0B: Local Development Setup

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker & Docker Compose (for PostgreSQL + Typesense)
- Git

## Installation

### 1. Install Dependencies

```bash
npm install
```

This installs:
- Express.js web framework
- Knex.js database query builder
- PostgreSQL driver (pg)
- Typesense client
- JWT authentication
- CSV parsing
- Form file handling (multer)

### 2. Start Docker Services

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** on localhost:5432
  - Database: caracaltech_ecu
  - User: caracaltech
  - Password: caracaltech
- **Typesense** on localhost:8108
  - API Key: typesense_api_key (from .env)

### 3. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=caracaltech
DB_PASSWORD=caracaltech
DB_NAME=caracaltech_ecu

# API
API_PORT=3000
NODE_ENV=development
RUN_MIGRATIONS=true

# Typesense
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_API_KEY=typesense_api_key

# Admin
ADMIN_PASSWORD=admin

# JWT
JWT_SECRET=your-secret-key-here

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# Logging
LOG_LEVEL=info
```

### 4. Run Migrations

Migrations run automatically on startup if `RUN_MIGRATIONS=true`.

To run manually:

```bash
npm run migrate
```

To rollback:

```bash
npm run migrate:rollback
```

## Running the Server

### Development Mode (with hot reload)

```bash
npm run dev
```

This uses Nodemon to auto-restart on file changes.

### Production Mode

```bash
npm start
```

## Testing the API

### 1. Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-05-26T...",
  "services": {
    "database": "connected",
    "typesense": "connected"
  }
}
```

### 2. API Documentation

```bash
curl http://localhost:3000/api
```

Returns all available endpoints and their descriptions.

### 3. Login & Get JWT Token

```bash
curl -X POST http://localhost:3000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin"
  }'
```

Response:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h"
}
```

### 4. Search by Vehicle Make/Model

```bash
curl "http://localhost:3000/api/search/vehicle?make=Mercedes-Benz&model=E-Class"
```

### 5. Upload CSV Batch

First, prepare a CSV file (e.g., `vehicles.csv`):

```csv
make,model,year_start,year_end,primary_market,markets,vin_pattern,notes
Mercedes-Benz,E-Class,2016,2020,EU,"[""EU"",""GCC""]",WDB,E-Class W213
BMW,3-Series,2017,2021,EU,"[""EU"",""US""]",WBADT,F30/F31 generation
```

Then upload:

```bash
TOKEN="<jwt_token_from_login>"

curl -X POST http://localhost:3000/api/admin/import/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@vehicles.csv" \
  -F "tableName=vehicles" \
  -F "sourceId=<uuid_of_test_source>"
```

Response:
```json
{
  "success": true,
  "batchId": "...",
  "summary": {
    "totalRecords": 2,
    "validRecords": 2,
    "invalidRecords": 0,
    "conflictDetected": 0
  },
  "nextStep": "commit"
}
```

### 6. Preview Batch

```bash
TOKEN="<jwt_token>"
BATCH_ID="<batch_id_from_upload>"

curl "http://localhost:3000/api/admin/import/$BATCH_ID/preview" \
  -H "Authorization: Bearer $TOKEN"
```

### 7. Commit Batch

```bash
curl -X POST http://localhost:3000/api/admin/import/$BATCH_ID/commit \
  -H "Authorization: Bearer $TOKEN"
```

## Database Operations

### View Schema

```bash
docker exec caracaltech_postgres psql -U caracaltech -d caracaltech_ecu -c "\dt"
```

### Check Sources

```bash
docker exec caracaltech_postgres psql -U caracaltech -d caracaltech_ecu -c "SELECT id, name, type, credibility_score FROM sources;"
```

### Check Audit Logs

```bash
docker exec caracaltech_postgres psql -U caracaltech -d caracaltech_ecu -c "SELECT action, table_name, record_id, change_reason, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 20;"
```

## Troubleshooting

### Database Connection Failed

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution**: Ensure Docker Compose is running:
```bash
docker-compose ps
# Should show caracaltech_postgres and caracaltech_typesense running
```

### Migrations Failed

```
Error: migration table not found
```

**Solution**: Reset database:
```bash
docker-compose down -v
docker-compose up -d
npm run migrate
```

### JWT Token Invalid

```
401 Unauthorized: Invalid or expired token
```

**Solution**: Get a fresh token:
```bash
curl -X POST http://localhost:3000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin"}'
```

### CSV Parse Error

```
CSV parse failed: invalid ...
```

**Solution**: Ensure CSV is UTF-8 with CRLF line endings:
```bash
# On macOS/Linux
dos2unix vehicles.csv

# Or convert with:
sed -i 's/$/\r/' vehicles.csv
```

## Monitoring

### View Logs

```bash
npm run dev
# Logs output to console in development
```

### Check Database Performance

```bash
docker exec caracaltech_postgres psql -U caracaltech -d caracaltech_ecu -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname='public' ORDER BY pg_total_relation_size DESC;"
```

### Monitor Imports

```bash
docker exec caracaltech_postgres psql -U caracaltech -d caracaltech_ecu -c "SELECT id, batch_status, total_records, valid_records, conflict_records, validated_at FROM import_batches ORDER BY validated_at DESC LIMIT 10;"
```

## Next Steps

1. **Build Frontend** (Phase 0C)
   - Search UI with VIN/part number input
   - Admin panel for CSV upload & conflict resolution
   - Audit log viewer

2. **Integrate Typesense** (Phase 0C)
   - Index schemas
   - Search document projection
   - Fuzzy matching configuration

3. **Populate Data** (Phase 1)
   - Collect vehicle data from sources
   - Import ECU compatibility data
   - Build tool method compatibility matrix

4. **Testing** (Ongoing)
   - Unit tests for validation functions
   - Integration tests for import pipeline
   - API endpoint tests
   - Load testing for search performance

---

**Phase 0B Local Setup: Complete**
