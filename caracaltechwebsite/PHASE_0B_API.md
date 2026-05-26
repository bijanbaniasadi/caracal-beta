# Phase 0B: API Endpoints & Import Service

## Overview

Phase 0B implements the complete REST API for the CaracalTech ECU Intelligence Platform with:
- **Search API**: VIN, part number, vehicle searches
- **Admin API**: CSV import pipeline with validation and conflict resolution
- **Audit Logging**: Complete transaction history
- **JWT Authentication**: Token-based admin access

## Architecture

### Services

**ImportService** (`src/services/importService.js`)
- Stage 1: CSV parsing
- Stage 2: Schema validation
- Stage 3: Conflict detection (similarity scoring)
- Stage 4: Staging records + preview
- Stage 5: Transactional commit with audit trails

**SearchService** (`src/services/searchService.js`)
- VIN-based vehicle lookup (WMI extraction)
- ECU part number search
- Vehicle search by make/model/year/market
- Compatibility matrix generation
- Tool compatibility lookup

### Utilities

**validation.js** - Schema enforcement
- ENUM whitelist validation
- Foreign key checking
- Type coercion and range validation
- Batch-level error accumulation

**similarity.js** - Conflict detection
- Levenshtein distance for string similarity
- Field-weighted similarity scoring
- Duplicate detection (90%+ similarity)
- Conflict type classification (exact duplicate vs. similar record)

## API Endpoints

### Search Endpoints

#### GET /api/search/vin
Search for vehicles by VIN pattern (WMI).

**Query Parameters:**
- `vin` (required): VIN or WMI pattern (min 3 chars)

**Response:**
```json
{
  "success": true,
  "found": true,
  "vin": "WDB1234567890",
  "wmi": "WDB",
  "results": [
    {
      "vehicle": { "id", "make", "model", "year_start", "year_end", ... },
      "engines": [ { "id", "engine_code", "displacement_cc", ... } ],
      "applications": [ { "id", "region", "ecu_model_id", "confidence_score", ... } ],
      "tools": [ { "toolId", "toolName", "methods": [ ... ] } ]
    }
  ]
}
```

#### GET /api/search/part-number
Search for ECU part numbers (exact or fuzzy).

**Query Parameters:**
- `partNumber` (required): Part number string (min 2 chars)

**Response:**
```json
{
  "success": true,
  "found": true,
  "partNumber": "A6229061800",
  "results": [
    {
      "partNumber": { "id", "part_number", "part_number_type", "oem_equivalents", ... },
      "ecuModel": { "model_code", "family_code", "memory_kb", ... },
      "applications": [ { "vehicle_id", "make", "model", "region", ... } ],
      "tools": [ { "toolId", "toolName", ... } ]
    }
  ]
}
```

#### GET /api/search/vehicle
Search for vehicles by make, model, year, or market.

**Query Parameters:**
- `make` (optional): Vehicle manufacturer (case-insensitive)
- `model` (optional): Model name (case-insensitive)
- `year` (optional): Production year
- `market` (optional): Market code (EU, US, CN, GCC, RU, AU, JP)
- `limit` (optional): Results per page (default 100, max 500)

**Response:**
```json
{
  "success": true,
  "found": true,
  "filters": { "make": "Mercedes-Benz", "model": "E-Class", ... },
  "totalResults": 5,
  "results": [
    {
      "id", "make", "model", "year_start", "year_end", "markets",
      "engineCount": 3,
      "ecuCount": 6
    }
  ]
}
```

#### GET /api/search/compatibility/:vehicleId
Get full ECU compatibility matrix for a vehicle.

**Path Parameters:**
- `vehicleId` (required): Vehicle UUID

**Response:**
```json
{
  "success": true,
  "vehicle": { "id", "make", "model", "year_start", "year_end", ... },
  "applications": [
    {
      "application": { "id", "region", "confidence_score", "verified_by_admin", ... },
      "tools": [
        {
          "toolId", "toolName", "toolCode", "manufacturer",
          "methods": [
            { "methodType", "supportStatus", "supportsRead", "supportsWrite", "confidenceScore" }
          ]
        }
      ]
    }
  ]
}
```

#### GET /api/search/typesense
Full-text search via Typesense (if enabled).

**Query Parameters:**
- `query` (required): Search text (min 2 chars)
- `collection` (optional): Collection name (default: vehicles)

**Response:**
```json
{
  "success": true,
  "query": "MED17.1",
  "foundCount": 25,
  "hits": [
    {
      "document": { ... Typesense document ... },
      "highlights": [ ... ]
    }
  ]
}
```

### Admin Endpoints

**All admin endpoints require JWT authentication:**
```
Authorization: Bearer <JWT_TOKEN>
```

#### POST /api/admin/auth/login
Obtain JWT token for admin operations.

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "admin_password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "expiresIn": "24h"
}
```

#### POST /api/admin/import/upload
Upload and parse CSV file, create import batch.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Headers: `Authorization: Bearer <token>`

**Form Fields:**
- `file` (required): CSV file (max 10MB)
- `tableName` (required): Target table (vehicles, engines, ecu_families, ecu_models, ecu_part_numbers, vehicle_ecu_applications, tool_ecu_methods)
- `sourceId` (required): Source UUID

**Response:**
```json
{
  "success": true,
  "batchId": "uuid",
  "summary": {
    "totalRecords": 100,
    "validRecords": 98,
    "invalidRecords": 2,
    "conflictDetected": 3
  },
  "nextStep": "resolve_conflicts"
}
```

#### GET /api/admin/import/:batchId/preview
Preview batch before commit.

**Response:**
```json
{
  "success": true,
  "batchId": "uuid",
  "preview": {
    "batch": { "id", "batch_status", "total_records", "valid_records", "conflict_records", ... },
    "stagingCount": 100,
    "conflictCount": 3,
    "staging": [ { "sequence_number", "raw_data", "validation_status", ... } ],
    "conflicts": [
      { "conflictType", "similarity", "incoming_data", "existing_data", "resolution_status" }
    ]
  }
}
```

#### POST /api/admin/import/:batchId/resolve-conflicts
Resolve conflicts in batch.

**Request Body:**
```json
{
  "conflicts": [
    {
      "conflictId": "uuid",
      "resolution": "keep_existing" | "use_incoming" | "merge" | "manual_review"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "batchId": "uuid",
  "resolved": 3,
  "unresolvedRemaining": 0,
  "readyToCommit": true
}
```

#### POST /api/admin/import/:batchId/commit
Commit batch to production (transactional).

**Response:**
```json
{
  "success": true,
  "batchId": "uuid",
  "recordsInserted": 100,
  "message": "Successfully imported 100 records"
}
```

#### GET /api/admin/audit-log
Get audit logs with filtering.

**Query Parameters:**
- `tableName` (optional): Filter by table
- `action` (optional): Filter by action (INSERT, UPDATE, DELETE)
- `userId` (optional): Filter by user
- `startDate` (optional): ISO date filter
- `endDate` (optional): ISO date filter
- `limit` (optional): Results per page (default 100)

**Response:**
```json
{
  "success": true,
  "filters": { "tableName": "vehicles", ... },
  "totalLogs": 250,
  "logs": [
    {
      "id", "action", "user_id", "table_name", "record_id",
      "old_data", "new_data", "change_reason", "created_at"
    }
  ]
}
```

## Usage Examples

### 1. Search by VIN

```bash
curl "http://localhost:3000/api/search/vin?vin=WDB1234567890"
```

### 2. Upload CSV Batch

```bash
curl -X POST http://localhost:3000/api/admin/import/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@vehicles.csv" \
  -F "tableName=vehicles" \
  -F "sourceId=<uuid>"
```

### 3. Get Batch Preview

```bash
curl http://localhost:3000/api/admin/import/<batchId>/preview \
  -H "Authorization: Bearer <token>"
```

### 4. Resolve Conflicts

```bash
curl -X POST http://localhost:3000/api/admin/import/<batchId>/resolve-conflicts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "conflicts": [
      {"conflictId": "<uuid>", "resolution": "keep_existing"}
    ]
  }'
```

### 5. Commit Batch

```bash
curl -X POST http://localhost:3000/api/admin/import/<batchId>/commit \
  -H "Authorization: Bearer <token>"
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error description"
}
```

Common HTTP Status Codes:
- `200` - Success
- `400` - Bad request (invalid parameters)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not found
- `500` - Server error

## Database Transactions

The commit operation is fully transactional:
- All-or-nothing semantics
- Automatic rollback on any error
- Audit trails created atomically
- Source tracking linked to records
- Confidence scores computed at insert time

## Performance Notes

- VIN search indexed on `vin_pattern`
- Part number search uses exact match, then LIKE fallback
- Similarity scoring O(n) per conflict detection
- Batch commit scales to 10k records
- Audit log retention: no purge (retention policy managed separately)

## Security

- All admin endpoints require JWT authentication
- Tokens expire after 24 hours
- Password validation against ADMIN_PASSWORD env var
- CORS configured per environment
- Helmet.js security headers enabled
- No SQL injection (parameterized queries via Knex)

## Next Steps (Phase 0C)

1. Build frontend search UI (Vue.js or React)
2. Admin panel with conflict resolution UI
3. Typesense integration & indexing
4. Advanced filtering and sorting
5. Data export functionality

---

**Phase 0B Status**: API implementation complete and ready for testing
