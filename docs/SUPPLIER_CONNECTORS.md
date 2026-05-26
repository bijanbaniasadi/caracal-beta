# Supplier Connectors

The production supplier sync has four staging-only connectors:

- `automaxtools` - Automax Tools, WooCommerce-style catalog pages
- `mk3` - MK3, NopCommerce-style catalog pages
- `obdii365` - OBDII365, legacy IIS catalog pages
- `uobdii` - UOBDII, legacy IIS catalog pages

Run a safe dry run:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api \
  pnpm --filter @caracal/api supplier:sync -- \
  --mode=dry-run \
  --sources=automaxtools,mk3,obdii365,uobdii \
  --limit=5 \
  --delay-ms=1000
```

Stage rows for admin approval:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api \
  pnpm --filter @caracal/api supplier:sync -- \
  --mode=stage \
  --sources=automaxtools,mk3,obdii365,uobdii \
  --limit=25 \
  --delay-ms=1000
```

The sync writes to `StagingProduct` with `status = PENDING`. It never publishes directly in the daily cron path. Publishing still requires an admin approval from `/admin/catalog/sync`.

Pricing rule:

- Convert supplier price to AED.
- Set staged sale price to AED price plus 15%.
- Set old price so the sale price displays as a 10% discount.
- Block admin approval when the staged sale price is below
  `SUPPLIER_SYNC_MIN_SALE_PRICE_CENTS` or above `SUPPLIER_SYNC_MAX_SALE_PRICE_CENTS`.
  Defaults are AED 100 and AED 200,000.

Brand safety:

- Supplier names are removed from normalized text where possible.
- Supplier images are staged with `imageApproved = false`.
- Any staged image URL adds an `image_requires_manual_brand_review` warning.

Install the daily production cron:

```bash
APP_DIR=/var/www/caracaltech \
SOURCES=automaxtools,mk3,obdii365,uobdii \
LIMIT=25 \
DELAY_MS=1000 \
sh scripts/install-supplier-sync-cron.sh
```

Logs are written to `/var/log/caracal-supplier-sync.log`.
