# Legacy Shop Launch Readiness

Generated: 2026-05-25

## Verdict

Catalog integration is ready for production review. The full legacy catalog is imported into PostgreSQL, `/shop` and product detail pages are reading migrated data through the API, category filters are backed by real category counts, and runtime checks passed for search, pagination, image rendering, and mobile layout.

## Database Import

| Check                               | Result |
| ----------------------------------- | -----: |
| Expected legacy products            | 10,452 |
| Imported legacy products            | 10,452 |
| Total products in database          | 10,459 |
| Active products in database         | 10,458 |
| Expected legacy categories          |     14 |
| Imported legacy categories          |     14 |
| Total active categories             |     18 |
| Legacy product image rows           | 10,444 |
| Legacy inventory rows               | 10,452 |
| Products without local legacy image |      8 |

The total product count is higher than the legacy count because the pre-existing non-legacy catalog products were preserved instead of being deleted or archived.

## Category Counts

| Category                 | Active Products |
| ------------------------ | --------------: |
| ECU and TCU Tuning Tools |               3 |
| Workshop Tools           |               1 |
| Calibration Software     |               1 |
| Tuning Tools             |           1,387 |
| Courses                  |               1 |
| Workshop Equipment       |               1 |
| Diagnostic Tools         |             521 |
| ECU Adapters             |               1 |
| Services                 |           1,531 |
| Cables & Adapters        |           1,025 |
| Key Programming          |           5,928 |
| ADAS Calibration         |               5 |
| ECU Calibration & Tuning |               7 |
| Module Programming       |              13 |
| Online OEM Access Tokens |              11 |
| EEPROM & Data Services   |               6 |
| Performance Upgrades     |              11 |
| Feature Coding           |               5 |

## Runtime Verification

| Check                     | Result                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------- |
| Local image scan          | Passed: 0 broken local legacy image refs                                            |
| Remote product image refs | 0                                                                                   |
| Offset pagination         | Passed: `/api/products?limit=24&page=1` and page 2 returned 24 items                |
| Cursor pagination         | Passed: first and second cursor pages returned 24 items with next cursors           |
| Search                    | Passed: `/api/products/search?q=abrites&limit=12&page=1` returned 304 total matches |
| Category filter           | Passed: `key-programming` returned 5,928 total matches                              |
| Desktop `/shop` render    | Passed: HTTP 200, 0 console errors, 0 broken rendered images                        |
| Mobile `/shop` render     | Passed: HTTP 200, 0 console errors, 0 broken rendered images                        |
| Product detail render     | Passed: HTTP 200, migrated product data and image rendered                          |

## Validation Commands

| Command                                            | Status                                                |
| -------------------------------------------------- | ----------------------------------------------------- |
| `pnpm --filter @caracal/api type-check`            | Passed                                                |
| `pnpm --filter @caracal/api build`                 | Passed                                                |
| `pnpm --filter @caracal/api test`                  | Passed                                                |
| `pnpm --filter @caracal/api migrate:deploy`        | Passed                                                |
| `pnpm --filter @caracal/api catalog:import:legacy` | Passed                                                |
| `pnpm --filter @caracal/api catalog:verify:legacy` | Passed                                                |
| `pnpm --filter @caracal/web type-check`            | Blocked by pre-existing untracked B2B prototype files |

## Notes

- No ECU worker/runtime files were modified.
- Checkout runtime files were not modified.
- The import is idempotent and uses SKU-based product upserts.
- Matching legacy SKUs keep stable product records while core migrated catalog fields are refreshed.
- Legacy images are stored as local Next.js public asset paths; broken source images are preserved in metadata but not inserted as renderable product image rows.
- The API now exposes total counts for server-side pagination while preserving cursor pagination for the existing infinite-scroll client.

## Follow-Up Before Launch

1. Resolve or move the untracked B2B prototype files so `@caracal/web` type-check/build can run cleanly.
2. Decide whether the six active non-legacy catalog products should remain visible alongside the migrated legacy catalog.
3. Ensure production Redis is available for the full API runtime; local catalog checks passed, but the dev API logs Redis connection errors when Redis is not running.
