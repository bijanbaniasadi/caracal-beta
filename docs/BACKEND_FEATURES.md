# Backend Feature Intake

This backend slice adds production-safe public intake endpoints without changing the repository architecture.

## Endpoints

All successful responses use:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

Errors use:

```json
{
  "success": false,
  "error": {
    "code": "validation_error",
    "message": "Request validation failed."
  },
  "meta": {
    "requestId": "..."
  }
}
```

### BIN Upload

`POST /api/bin-uploads`

Content type: `multipart/form-data`

Fields:

- `file`: required `.bin` file
- `requesterName`: optional
- `requesterEmail`: optional
- `productContext`: optional
- `quoteRequestId`: optional
- `notes`: optional

Security behavior:

- Accepts only `.bin` filenames
- Limits file count to one
- Enforces `BIN_UPLOAD_MAX_SIZE`
- Stores files as opaque `application/octet-stream`
- Generates SHA-256 hashes
- Stores locally by default under `LOCAL_UPLOAD_DIR`
- Uses Cloudflare R2 when all `R2_*` variables are configured

### Quote Request

`POST /api/quote-requests`

Required fields:

- `customerName`
- `customerEmail`
- `message`

Optional fields:

- `customerPhone`
- `companyName`
- `workshopName`
- `vehicleDetails`
- `requestedItems`
- `source`
- `metadata`

### Product Inquiry

`POST /api/product-inquiries`

Required fields:

- `productName`
- `customerName`
- `customerEmail`
- `message`

Optional fields:

- `productId`
- `productSku`
- `customerPhone`
- `companyName`
- `quantity`
- `source`
- `metadata`

### Workshop Consultation Lead

`POST /api/workshop-consultations`

Required fields:

- `workshopName`
- `contactName`
- `contactEmail`
- `message`

Optional fields:

- `contactPhone`
- `location`
- `monthlyVolume`
- `serviceInterests`
- `preferredTimeline`
- `source`
- `metadata`

## Audit Logs

Each successful intake write creates an `AuditLog` row with:

- request id
- actor type
- entity type and id
- action
- IP address
- user agent
- non-sensitive metadata

## Rate Limiting

- General API limiter: `RATE_LIMIT_MAX_REQUESTS`
- Intake limiter: `INTAKE_RATE_LIMIT_MAX`
- Upload limiter: `UPLOAD_RATE_LIMIT_MAX`

The API sets `trust proxy` for deployment behind Cloudflare or another reverse proxy.
