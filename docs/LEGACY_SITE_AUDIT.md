# Legacy Site Audit

Generated: 2026-05-24

Source backup: `C:\Codex\caracaltechmotors_public_html_manual_backup_2026-05-22`

Scope: backend/data migration analysis only. The PHP architecture, page rendering, session handling, payment implementation, and old business logic should not be migrated into the new monorepo. Reusable content, catalog shape, SEO URLs, and asset references are extracted into import-ready JSON files under `docs/legacy-migration`.

## Inventory Summary

- Total files inspected by recursive inventory: 6712
- PHP files inspected: 66
- SQL files inspected: 4
- JSON data files inspected: 17
- Asset/static files inventoried: 6619

Extension counts:

- .jpg: 6372
- .png: 203
- .php: 66
- .webp: 28
- .json: 17
- [none]: 5
- .csv: 5
- .txt: 4
- .sql: 4
- .svg: 3
- .css: 1
- .js: 1
- .ico: 1
- .md: 1
- .xml: 1

Asset categories:

- product-image-pool: 6359
- article-cover: 83
- article-image: 71
- service-image: 70
- device-image: 9
- site-brand-or-seo: 7
- training-article-image: 6
- site-asset: 6
- academy-download: 4
- other-asset: 4

## Reusable Catalog Structure

The legacy shop is centered on `shop_categories`, `shop_products`, optional `shop_variants`, server-side carts, orders, order items, payment transactions, coupons, and settings. Prices are AED minor units. The operational currency is explicitly configured as AED in `shop.default_currency`.

Product import data was found in `data/products-import.sql` with 29 hardware/tool products. Demo service/course products were also present in `database/shop.sql`.

Legacy import category counts:

- tuning-tools: 10
- diagnostic-tools: 14
- cables-adapters: 1
- key-programming: 4

Reusable product signals:

- SKU is the strongest product identity field.
- `ct_product_id` should be preserved as a legacy external id if imported.
- `price_minor` and `compare_price_minor` are AED fils.
- `track_stock`, `stock_qty`, and `is_digital` map cleanly into the new inventory/catalog foundation.
- Product detail pages supported cart purchase plus post-payment WhatsApp or technical follow-up, so products should remain inquiry-ready in the new backend.
- Product media exists, but `assets/images/products` is mostly a candidate pool and needs manual SKU-to-image mapping.

Seed outputs:

- `docs/legacy-migration/products.seed.json`
- `docs/legacy-migration/categories.seed.json`
- `docs/legacy-migration/brands.seed.json`

## Categories

Reusable legacy categories:

- `tuning-tools`
- `diagnostic-tools`
- `cables-adapters`
- `key-programming`
- `tools`
- `courses`
- `services`

Suggested new taxonomy additions from content:

- `calibration-software` for WinOLS, ECM Titanium, A2L/DAMOS, and tuning software pages.
- `ecu-tcu-tuning-tools` can be used as a public route alias for tool catalog SEO while preserving backend category slugs.

## Articles And Blog Content

`data/seo-articles.json` contains 83 importable articles with slug, title, description, category, image, thumbnail, body HTML, keywords, featured/landing flags, and update dates. `data/training-library-sources.json` adds 12 training source records.

The most important SEO rule is to preserve `/knowledge/{slug}` for every article. The legacy `.htaccess` already used this as the public canonical pattern and rewrote it internally to `knowledge-article.php?slug={slug}`.

High-value article URLs identified:

- `/knowledge/caracaltech-dealers-worldwide` - CaracalTech Dealers Worldwide!
- `/knowledge/top-10-ecu-tuning-tools` - Top 10 ECU Tuning Tools
- `/knowledge/what-is-kess3` - What is KESS3?
- `/knowledge/ecm-titanium-software` - ECM Titanium Software
- `/knowledge/top-ecu-tuning-software` - Top ECU Tuning Software
- `/knowledge/what-is-stage-tuning` - What is Stage Tuning?
- `/knowledge/what-are-the-best-ecu-tuning-companies-in-the-world` - What are The Best ECU Tuning Companies in The World?
- `/knowledge/software-winols-winols-training-pdf-free-download` - Software WinOLS / WinOLS Training PDF + Free Download
- `/knowledge/winols-damos-mappack-script-and-a2l` - WinOLS Damos, Mappack, Script and A2L
- `/knowledge/ecu-tuning-for-beginners` - ECU Tuning for Beginners
- `/knowledge/dtc-off-service-fault-code-delete-software-by-remap` - DTC Off Service - Fault Code Delete Software by Remap
- `/knowledge/how-to-make-pop-and-bang-by-remap` - How to make Pop and Bang by Remap ?
- `/knowledge/dpf-off-service-dpf-off-solution` - DPF Off Service - DPF Off Solution
- `/knowledge/adblue-off-service-disable-the-adblue-system` - AdBlue off Service - Disable The AdBlue System
- `/knowledge/what-is-an-ecu-data-logger` - What is an ECU Data logger?
- `/knowledge/what-is-ecu-cloning-and-how-is-it-down` - What is ECU Cloning and How is it Down?
- `/knowledge/ecm-titanium-vs-winols` - ECM Titanium VS WinOLS
- `/knowledge/what-is-ecu-remapping` - What is ECU Remapping?
- `/knowledge/remapping-knowledge` - Remapping knowledge
- `/knowledge/what-is-launch-control-how-to-add-launch-control-by-ecu-remap` - What is launch control & How to Add launch control by ECU Remap
- `/knowledge/how-to-have-your-own-ecu-tuning-business` - How to have your own ECU Tuning Business?
- `/knowledge/gearbox-tcu-tuning-remap-tools-software` - Gearbox (TCU) Tuning/ Remap tools & Software
- `/knowledge/kess-v2-clone-vs-original` - Kess V2 Clone vs Original
- `/knowledge/pros-and-cons-maf-sensor-removal-software` - Pros and Cons MAF Sensor Removal & Software
- `/knowledge/winols-tutorial-course` - WinOLS Tutorial Course
- `/knowledge/ecu-programmers` - ECU Programmers
- `/knowledge/what-is-ecu-tuning` - What is ECU Tuning?
- `/knowledge/ai-ecu-tuning` - AI ECU Tuning
- `/knowledge/auto-start-stop-delete-disable-from-ecu` - Auto Start Stop Delete/ Disable from ECU
- `/knowledge/the-best-car-to-remap-in-any-country-part1` - The best car to remap in any country (Part1)

Seed output:

- `docs/legacy-migration/articles.seed.json`

## ECU Tool Pages And Data

Reusable tool/data concepts:

- `ecu-lookup.php`, `lookup-api.php`, `lookup-options.php`, and `lookup-data.php` implement a searchable ECU/tool compatibility lookup.
- Lookup filters include type, brand, model, fuel, engine, engine code, ECU brand/model, MCU, tool, method, year, and free text query.
- Lookup data sources include KESS3, AutoTuner, CMD, Dimsport, Magic, PCMFlash, MultiProg, DFB driver lists, DTC modules, driver/tool support, and lookup cache JSON files.
- `data/ecu-knowledge.json` has reusable technical taxonomy for ECU families, tools, software, immo solutions, calibration safety, and logging/dyno guidance.
- `ecu-patcher.php` represents a licensed client tool concept; access approval lives in `patcher_licenses` managed from admin.

Do not port the PHP lookup builder directly. Reuse the datasets and rebuild the API around the new backend contracts.

## Uploads And File Handling

Upload-related legacy signals:

- `immo-data.php` and `chat-api.php` reference file intake flows.
- Observed accepted file types include `.bin`, `.ori`, `.mod`, `.eep`, `.hex`, `.fls`, `.mpc`, and `.txt`.
- `uploads/.htaccess` blocks server-side execution inside uploads.
- `data/immo_upload_requests.csv` is legacy request metadata and should be treated as sensitive operational history before any import.

The new backend should keep the stronger existing upload rejection/validation behavior and only import metadata after review.

## Calculators

`ecu-calculator.php` embeds an external calculator script from `https://ecuperformance.net/calculator/ecuob.js`. Treat this as a legacy integration reference only. Do not copy external calculator logic into the backend without vendor/legal review.

## Payment Flows

Legacy payment concepts discovered:

- Shop checkout: `checkout.php`, `shop-return.php`, `shop-webhook-stripe.php`, `includes/shop.php`, and `includes/shop-gateways.php`.
- Invoice payment: `invoice-payment.php`, `create-payment.php`, `success.php`, and `cancel.php`.
- Gateways: Stripe, PayPal, Telr, and manual bank transfer.
- Settings: Stripe enabled, PayPal enabled, Telr disabled, manual bank enabled, UAE VAT 5%, flat shipping 25 AED, free shipping over 300 AED.
- Stripe webhook verification and idempotent order finalization exist conceptually in PHP, but should be recreated with current backend primitives and secrets handling.

Do not migrate legacy gateway code or config files. Preserve only route intent, order states, and data model concepts.

## Admin Concepts

Legacy admin capability inventory:

- `admin.php`: consolidated dashboard for overview, users, orders, products, coupons, leads, subscribers, and ECU patcher access.
- `admin_shop.php`: shop-focused orders/products/coupons/leads/subscribers dashboard.
- `admin_panel.php`: earlier/simple client-user listing.
- `client_panel.php`: client account panel linking ECU lookup, invoice payment, and patcher license status.
- Legacy user roles are `admin` and `client`; map to the new role model deliberately instead of importing role names directly.

## Legacy Database Structures

SQL sources:

- `data/products-import.sql`
- `data/shop-upgrade.sql`
- `database/shop.sql`
- `database/users.sql`

Tables found:

- `growth_leads` from `database/shop.sql`
- `growth_subscribers` from `database/shop.sql`
- `shop_categories` from `database/shop.sql`
- `shop_products` from `database/shop.sql`
- `shop_variants` from `database/shop.sql`
- `shop_carts` from `database/shop.sql`
- `shop_cart_items` from `database/shop.sql`
- `shop_orders` from `database/shop.sql`
- `shop_order_items` from `database/shop.sql`
- `shop_payment_transactions` from `database/shop.sql`
- `shop_coupons` from `database/shop.sql`
- `shop_settings` from `database/shop.sql`
- `users` from `database/users.sql`

Important schema drift to handle before any import:

- data/products-import.sql inserts ct_product_id, but database/shop.sql does not define ct_product_id on shop_products.
- data/products-import.sql inserts compare_price_minor, while database/shop.sql defines compare_at_minor.
- includes/shop.php writes gateway_fee_minor on shop_orders, but database/shop.sql did not define that column in the observed CREATE TABLE.
- patcher_licenses is created dynamically by admin.php instead of living in database/*.sql.

Detailed DB structure output:

- `docs/legacy-migration/legacy-db-structures.json`

## Reusable Assets

High-confidence reusable assets:

- `logo.png`, `favicon.ico`, `robots.txt`, and `sitemap.xml` for brand/SEO reference.
- `kess3.png`, `autotuner.png`, `bflash.png`, plus `assets/images/devices/*` for core ECU tool catalog imagery.
- `article-covers/*` for preserving article visual identity.
- `article-images/training/*` for academy/training content.
- `assets/downloads/academy/*.csv` for reusable course/workshop templates.
- `assets/images/services/*` as candidate service landing imagery.

Full asset output:

- `docs/legacy-migration/asset-inventory.json`

## SEO-Important URLs

The legacy sitemap and rewrite rules make these URL families important:

- `/knowledge/{slug}` should be preserved exactly.
- Major legacy PHP pages need 301 redirects to modern route equivalents.
- Querystring detail routes like `product.php?slug=:slug`, `course.php?slug=:slug`, and `knowledge-article.php?slug=:slug` need explicit handling.
- Payment and webhook endpoints should be recreated securely; browser redirects are useful for public pages, but webhooks should not be exposed as legacy-compatible public pages.

Redirect output:

- `docs/legacy-migration/redirect-map.json`

## Files Needing Redirects Or Replacement

Redirect or replace public PHP routes in these groups:

- Public service routes: `ecu-tuning.php`, `ecu-remapping-dubai.php`, `ecu-tuning-tools.php`, `ecu-tuning-software.php`, `immo-dpf-adblue-services.php`, `ecu-tuning-dealers.php`, `projects.php`.
- Catalog routes: `shop.php`, `product.php`, `cart.php`, `checkout.php`, `shop-return.php`.
- Knowledge routes: `articles.php`, `knowledge-article.php`, `academy.php`, `course.php`.
- Tool routes: `ecu-lookup.php`, `ecu-calculator.php`, `ecu-patcher.php`, `immo-data.php`.
- Auth/admin routes: `login.php`, `register.php`, `client_panel.php`, `admin.php`, `admin_panel.php`, `admin_shop.php`.

Full PHP page output:

- `docs/legacy-migration/legacy-page-inventory.json`

## Import Readiness Notes

- Product and category JSON are ready for a backend importer, but image mapping should be reviewed before automatic import.
- Article JSON preserves body HTML for content parity. Run sanitization and encoding cleanup before rendering in production.
- Some legacy text appears to contain mojibake from old encoding paths. The seed JSON flags records with likely encoding issues.
- Do not import secrets from `db_config.local.php`, `stripe-config.php`, or gateway sample/config files.
- Do not port PHP sessions, mysqli/PDO helpers, or direct cURL gateway calls into the new backend.
