# Supplier Catalog Sync System Design

## Goal

Build a daily supplier catalog sync system on the VPS for:

- Automax Tools
- MK3
- OBDII365
- UOBDII

The sync must collect supplier product data, normalize prices to AED, identify products by SKU or stable source key, and stage new or changed products for admin approval before anything is published to the Caracal Tech Motors shop.

## Current Codebase Fit

The existing catalog already has the production-facing models:

- `Supplier`
- `Category`
- `Product`
- `ProductImage`
- `InventoryItem`

The supplier sync should not write directly to `Product` by default. It should write into staging rows first, then publish approved rows into the existing catalog tables.

Recommended sync flow:

```text
Supplier website
  -> source scraper
  -> raw product record
  -> normalized product record
  -> staging table
  -> admin approval
  -> Product / ProductImage / InventoryItem
```

## Database Schema

### Supporting Source Table

Use `SupplierSource` to define each external supplier feed.

```prisma
model SupplierSource {
  id            String   @id @default(cuid())
  supplierId    String?
  supplier      Supplier? @relation(fields: [supplierId], references: [id], onDelete: SetNull)
  slug          String   @unique
  name          String
  baseUrl       String
  currency      String   @default("AED")
  isActive      Boolean  @default(true)
  scrapeAllowed Boolean?
  robotsSummary String?
  metadata      Json?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

Initial rows:

| slug | name | baseUrl | currency |
| --- | --- | --- | --- |
| `automaxtools` | Automax Tools | `https://automaxtools.me` | `AED` |
| `mk3` | MK3 | `https://www.mk3.com` | `USD` |
| `obdii365` | OBDII365 | `https://www.obdii365.com` | `USD` |
| `uobdii` | UOBDII | `https://www.uobdii.com` | `USD` |

### Sync Run Table

Use `SupplierSyncRun` to track every execution.

```prisma
enum SupplierSyncMode {
  DRY_RUN
  STAGE
  PUBLISH
}

enum SupplierSyncRunStatus {
  RUNNING
  COMPLETED
  FAILED
}

model SupplierSyncRun {
  id              String                @id @default(cuid())
  sourceId        String?
  source          SupplierSource?       @relation(fields: [sourceId], references: [id], onDelete: SetNull)
  mode            SupplierSyncMode
  status          SupplierSyncRunStatus @default(RUNNING)
  startedAt       DateTime              @default(now())
  finishedAt      DateTime?
  discoveredCount Int                   @default(0)
  stagedCount     Int                   @default(0)
  acceptedCount   Int                   @default(0)
  reviewCount     Int                   @default(0)
  rejectedCount   Int                   @default(0)
  publishedCount  Int                   @default(0)
  errorMessage    String?
  metadata        Json?
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt
}
```

### Staging Table

Use `StagingProduct` as the product staging table.

```prisma
enum StagingProductStatus {
  PENDING
  READY
  APPROVED
  REJECTED
  PUBLISHED
}

model StagingProduct {
  id                  String                          @id @default(cuid())
  sourceId            String
  source              SupplierSource                  @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  runId               String?
  run                 SupplierSyncRun?                @relation(fields: [runId], references: [id], onDelete: SetNull)
  matchedProductId    String?
  matchedProduct      Product?                        @relation(fields: [matchedProductId], references: [id], onDelete: SetNull)

  sourceProductKey    String
  externalUrl         String
  externalSku         String?
  normalizedSku       String?
  externalName        String
  normalizedName      String
  brand               String?
  categoryName        String?

  rawPriceCents       Int?
  rawCurrency         String?
  convertedPriceCents Int?
  salePriceCents      Int?
  oldPriceCents       Int?
  discountPercent     Int                             @default(10)
  marginPercent       Int                             @default(15)

  stockStatus         InventoryStatus                 @default(IN_STOCK)
  imageUrl            String?
  imageApproved       Boolean                         @default(false)
  status              StagingProductStatus            @default(PENDING)
  warnings            Json?
  rejectReasons       Json?
  readyChecklist      Json?
  changedFields       Json?
  rawData             Json?
  normalizedData      Json?

  firstSeenAt         DateTime                        @default(now())
  lastSeenAt          DateTime                        @default(now())
  approvedAt          DateTime?
  publishedAt         DateTime?
  createdAt           DateTime                        @default(now())
  updatedAt           DateTime                        @updatedAt

  @@unique([sourceId, sourceProductKey])
  @@index([sourceId])
  @@index([runId])
  @@index([matchedProductId])
  @@index([status])
  @@index([normalizedSku])
  @@index([lastSeenAt])
}
```

`sourceProductKey` should be:

```text
source slug + ":" + normalized SKU
```

If SKU is missing:

```text
source slug + ":" + hash(canonical product URL)
```

## Price Normalization

All supplier prices should become AED minor units.

```text
raw supplier price -> convertedPriceCents AED
salePriceCents = convertedPriceCents * 1.15
oldPriceCents = salePriceCents / 0.90
displayed discount = 10%
```

Example:

```text
supplier price: AED 100.00
Caracal sale:   AED 115.00
old price:      AED 127.78
discount:       10%
```

The exchange rates should be environment-configured:

```env
SUPPLIER_SYNC_USD_AED=3.67
SUPPLIER_SYNC_EUR_AED=4.00
SUPPLIER_SYNC_GBP_AED=4.70
```

## Directory Structure

Recommended structure:

```text
apps/api/
  scrapers/
    __init__.py
    base_scraper.py
    automax_tools.py
    requirements.txt

  scripts/
    supplier-catalog-sync.ts
    upsert-staging-products.ts
    supplier-catalog-cleanup.ts

  src/lib/supplier-sync/
    index.ts
    config.ts
    types.ts
    pricing.ts
    normalization.ts
    validation.ts
    persistence.ts
    rate-limit.ts
    robots.ts

    sources/
      automaxtools.ts
      mk3.ts
      obdii365.ts
      uobdii.ts

    parsers/
      jsonld.ts
      html-product.ts
      sitemap.ts

    tests/
      pricing.test.ts
      normalization.test.ts
      validation.test.ts
```

Responsibilities:

| File | Responsibility |
| --- | --- |
| `scrapers/base_scraper.py` | Python base class for request headers, user-agent rotation, and rate limiting. |
| `scrapers/automax_tools.py` | Playwright prototype for Automax product discovery and extraction. |
| `scripts/upsert-staging-products.ts` | Prisma Client bridge that upserts scraper rows into `StagingProduct` with `PENDING` status. |
| `config.ts` | Supplier definitions, base URLs, currency defaults, source names to scrub. |
| `pricing.ts` | AED conversion, margin, discount, old price calculation. |
| `normalization.ts` | Normalize SKU, product name, category, brand, stock text. |
| `validation.ts` | Decide whether a row remains `PENDING`, can become `READY`, or should be `REJECTED`. |
| `persistence.ts` | Upsert `SupplierSource`, `SupplierSyncRun`, `StagingProduct`. |
| `rate-limit.ts` | Per-source crawl delay and request budgets. |
| `robots.ts` | Fetch and summarize robots.txt before crawling. |
| `sources/*.ts` | Source-specific discovery and parsing rules. |

## Rate Limiting

Default rules:

- One source at a time.
- 750-1500 ms delay between requests.
- Max products per source is configurable.
- Respect `robots.txt`.
- Use a clear user-agent.
- Retry only transient failures.
- Stop a source run if repeated HTTP errors occur.

Recommended env:

```env
SUPPLIER_SYNC_USER_AGENT="CaracalTechMotorsCatalogBot/1.0 (+https://caracaltechmotors.com)"
SUPPLIER_SYNC_LIMIT_PER_SOURCE=200
SUPPLIER_SYNC_DELAY_MS=1200
SUPPLIER_SYNC_MAX_FAILURES_PER_SOURCE=10
```

Daily VPS cron:

```cron
15 3 * * * cd /var/www/caracaltech && docker compose --env-file .env.production -f docker-compose.prod.yml exec -T api pnpm --filter @caracal/api supplier:sync -- --mode=stage >> /var/log/caracal-supplier-sync.log 2>&1
```

First production runs should use smaller limits:

```bash
pnpm --filter @caracal/api supplier:sync -- --mode=dry-run --limit=20
pnpm --filter @caracal/api supplier:sync -- --mode=stage --limit=20
```

## Persistence Rules

Every run must:

1. Create a `SupplierSyncRun` row with `RUNNING`.
2. Discover product URLs from sitemap/category/list pages.
3. Parse product data.
4. Normalize SKU, name, price, stock, and image URL.
5. Upsert into `StagingProduct` by `[sourceId, sourceProductKey]`.
6. Update `lastSeenAt`.
7. Store `rawData` and `normalizedData`.
8. Mark the run `COMPLETED` or `FAILED`.

No direct publish during normal daily sync.

Publishing should be a separate admin action or an explicit `--mode=publish` command.

## Change Detection

Detect changes by comparing the new normalized snapshot to the existing staging row.

Important fields:

- `normalizedName`
- `normalizedSku`
- `convertedPriceCents`
- `salePriceCents`
- `oldPriceCents`
- `stockStatus`
- `imageUrl`
- `externalUrl`

Recommended metadata:

```json
{
  "changedFields": ["salePriceCents", "stockStatus"],
  "previous": {
    "salePriceCents": 115000,
    "stockStatus": "IN_STOCK"
  },
  "current": {
    "salePriceCents": 119000,
    "stockStatus": "LOW_STOCK"
  }
}
```

## Product Matching

Matching priority:

1. Exact normalized SKU match.
2. Exact source product key match.
3. Existing `Product.metadata.sourceProductKey`.
4. Fuzzy match by brand + normalized model/name.
5. Manual admin match.

Never auto-merge products from different suppliers unless SKU or admin mapping confirms they are the same product.

## Content and Brand Safety

Allowed to keep:

- Real manufacturer brands: Autel, Launch, Xhorse, OBDSTAR, Alientech, Magicmotorsport, etc.
- Real model names and part numbers.
- Factual specs.

Must remove or rewrite:

- Supplier store names: Automax Tools, MK3, OBDII365, UOBDII.
- Supplier promotional copy.
- Supplier contact details.
- Supplier warranty/shipping claims.
- Any copied "about us" wording.

Images:

- Do not auto-publish supplier images.
- Stage image URLs for review.
- Mark `imageApproved=false` by default.
- Reject images that appear to contain supplier watermarks, supplier logos, or competitor contact details.
- Use Caracal-approved images, manufacturer-approved images, or placeholders until reviewed.

## Ready To Approve Checklist

A staged product is ready for approval only when all are true:

- Has a stable `sourceProductKey`.
- Has `normalizedSku` or a reliable canonical product URL.
- Product name is clean and does not contain supplier-store branding.
- Real manufacturer brand/model names are preserved.
- Price was parsed and converted to AED.
- `salePriceCents` follows the 15% margin rule.
- `oldPriceCents` produces a 10% displayed discount.
- Stock status is one of `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`, or `DISCONTINUED`.
- Category can be mapped to an existing Caracal category.
- Description is Caracal-written, not copied supplier text.
- No supplier phone, URL, WhatsApp, email, or store name appears in description.
- Image is either approved or left unpublished.
- Product does not duplicate an existing Caracal product incorrectly.
- Staging status remains `PENDING` after scraper insert/update. A separate validator/admin action may later mark it `READY`.
- Admin has reviewed any warnings.

Automatic rejection criteria:

- Missing name.
- Missing price.
- Unsupported currency.
- Supplier name remains in normalized title or description.
- Product URL is not canonical or looks like a cart/account/search page.
- Image is the only source of product identity.
- Product appears unrelated to automotive diagnostics, key programming, ECU tools, tuning, workshop equipment, or file services.

Manual review criteria:

- Missing SKU.
- Large price change compared with previous snapshot.
- Conflicting stock status.
- New category not mapped.
- Product name is too generic.
- Image requires watermark/logo review.
- Same SKU appears on multiple suppliers with materially different product names.

## Publishing Rules

When approved:

1. Create or update `Product`.
2. Set `supplierId` to the Caracal-owned supplier row, not the external supplier.
3. Store the source attribution in `Product.metadata`, not visible storefront copy.
4. Set `priceCents = salePriceCents`.
5. Store `oldPriceCents` and `discountPercent` in `attributes`.
6. Create or update `InventoryItem` from staged stock status.
7. Do not create `ProductImage` unless the image is approved.
8. Keep checkout disabled or inquiry-first for products that are source-monitored but not physically stocked.

## VPS Operation

Deployment tasks:

- Run DB migration.
- Run first sync in dry-run mode.
- Run second sync in stage mode with small limits.
- Review staged rows in DB/admin.
- Enable daily cron only after source behavior is stable.

Recommended first commands:

```bash
pnpm --filter @caracal/api supplier:sync -- --mode=dry-run --limit=20
pnpm --filter @caracal/api supplier:sync -- --mode=stage --limit=20
```

Recommended daily command after validation:

```bash
pnpm --filter @caracal/api supplier:sync -- --mode=stage --limit=200
```

## Non-Goals

- Do not copy supplier descriptions verbatim.
- Do not remove watermarks from supplier images.
- Do not auto-delete existing Caracal products.
- Do not auto-publish new supplier products without validation.
- Do not bypass source robots.txt or source rate limits.
