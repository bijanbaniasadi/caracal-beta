# SEO Preservation Notes

Generated: 2026-05-24

## Canonical URL Strategy

Preserve `/knowledge/{slug}` exactly. The legacy `.htaccess` rewrote that path to `knowledge-article.php?slug={slug}`, and the sitemap lists the clean `/knowledge/...` form. The new site should keep the clean path as canonical and never expose `knowledge-article.php` as a canonical URL.

## Redirect Priorities

Critical 301 redirects:

- `/academy.php` -> `/academy`
- `/articles.php` -> `/knowledge`
- `/ecu-tuning.php` -> `/services/ecu-tuning`
- `/ecu-remapping-dubai.php` -> `/services/ecu-remapping-dubai`
- `/ecu-tuning-tools.php` -> `/catalog/ecu-tcu-tuning-tools`
- `/ecu-tuning-software.php` -> `/catalog/calibration-software`
- `/immo-dpf-adblue-services.php` -> `/services/immo-dpf-adblue`
- `/ecu-tuning-dealers.php` -> `/dealers`
- `/product.php?slug=:slug` -> `/products/:slug`
- `/course.php?slug=:slug` -> `/academy/:slug`
- `/knowledge-article.php?slug=:slug` -> `/knowledge/:slug`

Tool redirects:

- `/ecu-lookup.php` -> `/tools/ecu-lookup`
- `/ecu-calculator.php` -> `/tools/ecu-calculator`
- `/ecu-patcher.php` -> `/tools/ecu-patcher`
- `/immo-data.php` -> `/tools/immo-data`

Checkout/payment routes need careful handling. Public success/cancel/return pages can redirect, but API/webhook endpoints should be recreated securely and old endpoints should return 410 or be blocked once the new gateway is live.

## Sitemap And Metadata

Generate a new sitemap from the new route registry after import, but include every legacy `/knowledge/{slug}` that remains published. Preserve article titles, descriptions, keywords, updated dates, and cover images from `articles.seed.json` where quality is acceptable.

## Content Quality Checks

Before publishing imported articles:

- Sanitize stored HTML.
- Repair mojibake/encoding issues where flagged in `articles.seed.json`.
- Validate internal links that still point to `.php` routes.
- Replace external static-gallery image URLs with imported local assets when available.
- Keep dealer/contact directory content under review because it contains public third-party contact details from the legacy site.

## Noindex / Blocked Surfaces

Do not index admin, setup, config, webhook, lookup data, raw JSON, SQL, CSV request logs, or upload directories. The legacy backup already used `.htaccess` to block config/data access and upload script execution; mirror that intent in the new deployment.

Full redirect map: `docs/legacy-migration/redirect-map.json`.
