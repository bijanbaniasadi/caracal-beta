# Product Image Migration Report

Generated: 2026-05-25

Source backup: `C:\Codex\caracaltechmotors_public_html_manual_backup_2026-05-22`

Target asset directory: `apps/web/public/images/products/legacy-commercial`

## Scope

This pass restored launch-critical commercial product images only. ECU intelligence, workers, runtime infrastructure, and storefront styling were not changed.

## Legacy Crawl Findings

- Legacy named device assets found: 9 files in `assets/images/devices`.
- Legacy article cover assets available for product-category fallback imagery: 83 files in `article-covers`.
- Legacy numeric product image pool found: 6,359 `.jpg` files in `assets/images/products`, totaling 329,937,047 bytes.
- Duplicate filenames in the numeric product pool: 0.
- Direct SKU-to-image mappings in legacy SQL/PHP: not present. The old shop tables expose `image_url` and `gallery_json`, but `data/products-import.sql` does not populate product image URLs.
- Relative PHP-era image candidates were present in `docs/legacy-migration/products.seed.json`; live seed data now uses Next.js public URLs.

## Migrated Assets

13 SEO-safe product assets were copied into the Next.js public asset tree:

- `/images/products/legacy-commercial/alientech-kess3.png`
- `/images/products/legacy-commercial/autotuner-tool.webp`
- `/images/products/legacy-commercial/bflash-master-tool.png`
- `/images/products/legacy-commercial/ecu-programmer-tools.png`
- `/images/products/legacy-commercial/chip-tuning-tool.png`
- `/images/products/legacy-commercial/winols-calibration-software.png`
- `/images/products/legacy-commercial/ecu-bench-power-supply.png`
- `/images/products/legacy-commercial/ecu-bench-adapter-kit.png`
- `/images/products/legacy-commercial/automotive-diagnostic-interface.png`
- `/images/products/legacy-commercial/automotive-diagnostic-scanner.png`
- `/images/products/legacy-commercial/diagnostic-software-dongle.png`
- `/images/products/legacy-commercial/key-programming-tool.png`
- `/images/products/legacy-commercial/workshop-equipment.png`

Migrated asset size: 9,507,020 bytes.

Duplicate migrated file hashes: 0.

## Seed And DB Repair

Updated `apps/api/prisma/seeds/seed.ts` so every seeded commercial product resolves to a stable public product image URL.

Applied the repaired seed to the local PostgreSQL database with:

```powershell
pnpm --filter @caracal/api seed
```

## Runtime Validation

Database/file validation command:

```powershell
pnpm --filter @caracal/api exec tsx scripts/validate-product-images.ts
```

Results:

- Total DB products: 36.
- Seeded commercial products: 35.
- Products with working images: 35.
- Seeded commercial products with working images: 35.
- Remaining missing commercial images: 0.
- Broken local image URLs: 0.
- Product image URLs containing `/catalog`: 0.
- Orphaned migrated assets: 0.

Live API verification:

- Endpoint: `GET /api/products?limit=50`.
- API products returned: 35.
- API products with images: 35.
- Broken image results: 0.
- API product image URLs containing `/catalog`: 0.
- Sample runtime request ID: `11ece73a-93fb-4eb4-9b84-d88795f94979`.

Build validation:

- `pnpm --filter @caracal/web build`: passed after clearing a stale `.next` cache.
- `pnpm --filter @caracal/api type-check`: passed.

Remaining non-commercial missing image:

- `ADMIN-TEST-1779629815706`, status `ARCHIVED`. This is an old admin test product, not part of the seeded commercial catalog.

## Deferred Assets

The 6,359 numeric legacy product JPGs remain unmigrated because the backup does not contain a trustworthy SKU/image join. They should only be imported after a manual or source-backed SKU mapping is produced.
