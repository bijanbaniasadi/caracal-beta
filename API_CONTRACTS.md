# API Contracts

This document describes the currently implemented Caracal API contracts. The API base URL is configured by environment, with local development defaulting to `http://localhost:3001`.

## Response Envelope

Most API routes return the shared response envelope.

Successful response:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "req_..."
  }
}
```

Error response:

```json
{
  "success": false,
  "error": {
    "code": "validation_error",
    "message": "Request validation failed.",
    "details": {}
  },
  "meta": {
    "requestId": "req_..."
  }
}
```

`details` is included only when the error handler has structured details to return.

## Common Behavior

- JSON intake endpoints accept `application/json`.
- BIN upload accepts `multipart/form-data`.
- Request validation is enforced with Zod.
- All `/api/*` routes are rate limited.
- Successful intake writes create an `AuditLog` row.
- `meta.requestId` is attached to structured API responses.
- Unknown routes return `not_found`.

## Health And Service Status

### `GET /`

Returns structured service status.

Response `200`:

```json
{
  "success": true,
  "data": {
    "service": "caracal-api",
    "status": "ok"
  },
  "meta": {
    "requestId": "..."
  }
}
```

### `GET /health`

Returns a simple health payload for probes.

Response `200`:

```json
{
  "status": "ok",
  "service": "caracal-api",
  "version": "0.1.0",
  "timestamp": "2026-05-24T00:00:00.000Z"
}
```

## Quote Requests

### `POST /api/quote-requests`

Creates a quote request and returns the operational reference.

Required JSON fields:

| Field           | Type   | Rule                            |
| --------------- | ------ | ------------------------------- |
| `customerName`  | string | 1 to 160 characters             |
| `customerEmail` | string | valid email, max 254 characters |
| `message`       | string | 1 to 4000 characters            |

Optional JSON fields:

| Field            | Type     | Rule                                   |
| ---------------- | -------- | -------------------------------------- |
| `customerPhone`  | string   | 7 to 40 characters                     |
| `companyName`    | string   | 1 to 160 characters                    |
| `workshopName`   | string   | 1 to 160 characters                    |
| `vehicleDetails` | string   | 1 to 500 characters                    |
| `requestedItems` | string[] | max 25 items, each 1 to 160 characters |
| `source`         | string   | 1 to 80 characters, defaults to `api`  |
| `metadata`       | object   | arbitrary JSON object                  |

Example request:

```json
{
  "customerName": "Alex Rivera",
  "customerEmail": "alex@example.com",
  "customerPhone": "+15555550100",
  "vehicleDetails": "2020 Toyota Land Cruiser",
  "requestedItems": ["ECU tune", "Diagnostics"],
  "message": "Please quote diagnostics and tuning options.",
  "source": "website"
}
```

Response `201`:

```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "referenceCode": "QR-...",
    "status": "NEW",
    "createdAt": "2026-05-24T00:00:00.000Z"
  },
  "meta": {
    "requestId": "..."
  }
}
```

Audit action: `quote_request.created`

## Product Inquiries

### `POST /api/product-inquiries`

Creates a product inquiry and returns the operational reference.

Required JSON fields:

| Field           | Type   | Rule                            |
| --------------- | ------ | ------------------------------- |
| `productName`   | string | 1 to 200 characters             |
| `customerName`  | string | 1 to 160 characters             |
| `customerEmail` | string | valid email, max 254 characters |
| `message`       | string | 1 to 3000 characters            |

Optional JSON fields:

| Field           | Type    | Rule                                  |
| --------------- | ------- | ------------------------------------- |
| `productId`     | string  | 1 to 120 characters                   |
| `productSku`    | string  | 1 to 120 characters                   |
| `customerPhone` | string  | 7 to 40 characters                    |
| `companyName`   | string  | 1 to 160 characters                   |
| `quantity`      | integer | 1 to 100000                           |
| `source`        | string  | 1 to 80 characters, defaults to `api` |
| `metadata`      | object  | arbitrary JSON object                 |

Example request:

```json
{
  "productName": "Performance ECU",
  "productSku": "ECU-PERF-001",
  "customerName": "Alex Rivera",
  "customerEmail": "alex@example.com",
  "quantity": 2,
  "message": "Is this compatible with my workshop fleet?",
  "source": "website"
}
```

Response `201`:

```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "referenceCode": "PI-...",
    "status": "NEW",
    "createdAt": "2026-05-24T00:00:00.000Z"
  },
  "meta": {
    "requestId": "..."
  }
}
```

Audit action: `product_inquiry.created`

## Workshop Consultation Leads

### `POST /api/workshop-consultations`

Creates a workshop consultation lead and returns the operational reference.

Required JSON fields:

| Field          | Type   | Rule                            |
| -------------- | ------ | ------------------------------- |
| `workshopName` | string | 1 to 180 characters             |
| `contactName`  | string | 1 to 160 characters             |
| `contactEmail` | string | valid email, max 254 characters |
| `message`      | string | 1 to 4000 characters            |

Optional JSON fields:

| Field               | Type     | Rule                                   |
| ------------------- | -------- | -------------------------------------- |
| `contactPhone`      | string   | 7 to 40 characters                     |
| `location`          | string   | 1 to 240 characters                    |
| `monthlyVolume`     | integer  | 0 to 100000                            |
| `serviceInterests`  | string[] | max 30 items, each 1 to 160 characters |
| `preferredTimeline` | string   | 1 to 120 characters                    |
| `source`            | string   | 1 to 80 characters, defaults to `api`  |
| `metadata`          | object   | arbitrary JSON object                  |

Example request:

```json
{
  "workshopName": "Caracal Partner Workshop",
  "contactName": "Sam Patel",
  "contactEmail": "sam@example.com",
  "location": "Dubai",
  "monthlyVolume": 45,
  "serviceInterests": ["Diagnostics", "ECU programming"],
  "preferredTimeline": "This quarter",
  "message": "We want to discuss a workshop partnership.",
  "source": "website"
}
```

Response `201`:

```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "referenceCode": "WC-...",
    "status": "NEW",
    "createdAt": "2026-05-24T00:00:00.000Z"
  },
  "meta": {
    "requestId": "..."
  }
}
```

Audit action: `workshop_consultation_lead.created`

## BIN Uploads

### `POST /api/bin-uploads`

Uploads a single `.bin` file and persists upload metadata.

Content type: `multipart/form-data`

Required form fields:

| Field  | Type | Rule               |
| ------ | ---- | ------------------ |
| `file` | file | single `.bin` file |

Optional form fields:

| Field            | Type   | Rule                                               |
| ---------------- | ------ | -------------------------------------------------- |
| `requesterName`  | string | 1 to 160 characters                                |
| `requesterEmail` | string | valid email, max 254 characters                    |
| `productContext` | string | 1 to 240 characters                                |
| `quoteRequestId` | string | must match an existing quote request when provided |
| `notes`          | string | 1 to 1200 characters                               |

Upload constraints:

- One file per request.
- Filename extension must be `.bin`.
- Allowed MIME types are `application/octet-stream`, `application/macbinary`, `application/x-binary`, `application/x-msdownload`, or an empty MIME type.
- Maximum size is controlled by `BIN_UPLOAD_MAX_SIZE`, defaulting to `52428800` bytes.
- Empty uploads are rejected.

Example request:

```bash
curl -X POST http://localhost:3001/api/bin-uploads \
  -F "file=@sample.bin" \
  -F "requesterName=Alex Rivera" \
  -F "requesterEmail=alex@example.com" \
  -F "productContext=ECU diagnostics"
```

Response `201`:

```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "originalFileName": "sample.bin",
    "storedObjectKey": "bin-uploads/2026-05-24/...",
    "storageProvider": "LOCAL",
    "byteSize": 1024,
    "sha256": "...",
    "status": "STORED",
    "createdAt": "2026-05-24T00:00:00.000Z"
  },
  "meta": {
    "requestId": "..."
  }
}
```

Audit action: `bin_upload.created`

## Error Codes

| Code                    | Status | Meaning                                            |
| ----------------------- | -----: | -------------------------------------------------- |
| `validation_error`      |    400 | JSON payload failed schema validation              |
| `bad_request`           |    400 | Request metadata, upload, or relation check failed |
| `upload_error`          |    400 | Multer rejected the upload                         |
| `rate_limited`          |    429 | Rate limit exceeded                                |
| `not_found`             |    404 | Route was not found                                |
| `internal_server_error` |    500 | Unhandled server error                             |

## Rate Limits

| Scope                   | Environment variable      |            Default |
| ----------------------- | ------------------------- | -----------------: |
| General `/api/*` routes | `RATE_LIMIT_MAX_REQUESTS` | 100 per 15 minutes |
| Intake submissions      | `INTAKE_RATE_LIMIT_MAX`   |  30 per 15 minutes |
| BIN uploads             | `UPLOAD_RATE_LIMIT_MAX`   |        12 per hour |

The API emits standard rate limit headers and disables legacy rate limit headers.

## Persistence Notes

- Intake records start with status `NEW`.
- BIN upload records are written with status `STORED` after object persistence succeeds.
- Upload storage uses `LOCAL` by default and `R2` when all required R2 variables are configured.
- Successful writes create audit records with request ID, entity type, entity ID, actor type, IP address, user agent, and non-sensitive metadata.
