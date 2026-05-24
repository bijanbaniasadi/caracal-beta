# Commercial Migration Implementation Plan

Generated: 2026-05-24

Source backup: `C:\Codex\caracaltechmotors_public_html_manual_backup_2026-05-22`

Target platform: current Caracal Tech Motors monorepo with Next.js storefront, Express API, Prisma, PostgreSQL, Redis/BullMQ workers, and ECU intelligence infrastructure.

## Goal

Use the legacy production site as the source of commercial truth for launch-critical storefront, trust, SEO, and conversion gaps. Do not port PHP architecture, session handling, gateway code, or old business logic.

## Current Platform Coverage

Already present in the monorepo:

- Public storefront routes: `/`, `/shop`, `/shop/[slug]`, `/articles`, `/ecu-tools`, `/contact`.
- Backend catalog foundation: products, categories, suppliers, product images, inventory, carts, cart items, inquiries, audit logging.
- Admin/API foundation, auth/RBAC, upload validation, worker runtime, and ECU intelligence/indexing systems.
- Contact workflows for quote requests, product inquiries, workshop consultations, and BIN uploads.

## Legacy Commercial Signals

Reusable from the legacy site:

- 29 shop products from `data/products-import.sql`.
- Product categories: `tuning-tools`, `diagnostic-tools`, `cables-adapters`, `key-programming`.
- Payment intent: Stripe, PayPal, Telr, and manual bank transfer from `database/shop.sql`.
- Shipping settings: AED 25 flat UAE shipping and free-shipping threshold concept.
- Public policies: privacy, terms, shipping, and refund pages.
- SEO URLs from `sitemap.xml`, especially `.php` public routes and `/knowledge/{slug}` articles.
- Device imagery for KESS3, AutoTuner, BFlash, plus generic workshop imagery for unmapped products.

## Missing Before This Pass

- Footer policy routes returned 404 for `/privacy`, `/terms`, `/shipping`, and `/refund`.
- No Next.js `robots.ts` or `sitemap.ts`.
- No runtime redirects for legacy PHP routes.
- Catalog seed only had 6 products and pointed several product images at missing `/catalog/*.jpg` paths.
- Legacy shop inventory was not represented in the current Prisma seed.
- Shop page did not explain payment, fulfilment, or compatibility-support expectations.

## Launch-Critical Implemented

- Added policy pages:
  - `/privacy`
  - `/terms`
  - `/shipping`
  - `/refund`
- Added `robots.ts` and `sitemap.ts`.
- Added 301 redirects for public legacy PHP routes into current live routes.
- Redirected old knowledge/course URLs to the current `/articles` surface until article detail routes are imported.
- Updated catalog seed image paths to existing public assets.
- Imported the 29 legacy commercial products into the existing Prisma seed using the current Product, Category, Supplier, ProductImage, and InventoryItem models.
- Added current-model categories for diagnostic tools, cables/adapters, and key programming.
- Added legacy suppliers required by the imported product set.
- Added shop trust messaging for UAE fulfilment, payment options, and compatibility support.

## Deferred Deliberately

These are important, but not safe to rush into this launch-critical pass:

- Full checkout/order/payment schema and gateway integration.
- Stripe, PayPal, Telr, webhook, and invoice-payment backend rebuild.
- Querystring-aware product redirects from `product.php?slug=...` into exact `/shop/[slug]` routes.
- Full article detail import for all legacy `/knowledge/{slug}` pages.
- Manual SKU-to-photo mapping for the large legacy product image pool.
- Legacy account/client panel replacement.
- ECU lookup/calculator parity pages.

## Next Implementation Order

1. Import article detail pages using `articles.seed.json`, preserving `/knowledge/{slug}` as canonical or exact redirects.
2. Create an order/payment foundation behind the current cart APIs, using environment-based gateway secrets and webhook idempotency.
3. Add exact legacy product redirect handling where the source query contains `slug`.
4. Map high-value product SKUs to verified product photos from the legacy asset pool.
5. Add checkout trust surfaces only after payment/order backend contracts are stable.

## Production Readiness Notes

- Keep the inquiry-first product flow active until checkout/payment is fully validated.
- Do not expose old PHP payment, setup, data, upload, or webhook routes.
- Keep admin, API, upload, and raw data paths out of the sitemap and blocked in robots rules.
- Validate seed and product read APIs after every catalog import because the storefront depends on backend data at runtime.
