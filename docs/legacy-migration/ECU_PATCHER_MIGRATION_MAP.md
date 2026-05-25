# Legacy ECU Patcher Migration Map

Date: 2026-05-25

Legacy source:

- Backup path: `C:\Codex\caracaltechmotors_public_html_manual_backup_2026-05-22`
- Primary file: `ecu-patcher.php`
- Related files: `client_panel.php`, `admin.php`, `includes/auth-security.php`, `includes/site-shell.php`, `db_config.php`, `assets/site.css`
- Known legacy URL: `https://caracaltechmotors.com/ecu-patcher.php?lang=en`

Note: automated fetch of the live legacy URL returned HTTP 403, so implementation was verified against the local production backup.

## Old Files Used

- `ecu-patcher.php`
  - PHP session gate.
  - CSRF-protected access request form.
  - Inline CSS for the patcher shell/access gate.
  - Inline JavaScript patch arrays and patch execution helpers.
  - Client-side file picker/download handling.
- `client_panel.php`
  - Reads `patcher_licenses.status`.
  - Shows active/pending/request cards for the patcher suite.
- `admin.php`
  - Creates `patcher_licenses`.
  - Approves, rejects, grants, and revokes access.
  - Shows pending/approved request counts.
- `includes/auth-security.php`
  - Starts hardened PHP session.
  - Provides CSRF token helpers.
- `includes/site-shell.php`
  - Provides localized links, WhatsApp URLs, and shell rendering.

## Old Endpoint And Upload Flow

The legacy patcher did not use a server upload endpoint for binary patching.

1. Visitor opens `ecu-patcher.php`.
2. PHP checks `$_SESSION['user_id']`.
3. PHP reads `patcher_licenses` for that user.
4. If approved, JavaScript file inputs become available.
5. Browser reads the selected file with `File.arrayBuffer()`.
6. Browser applies patch arrays locally.
7. Browser downloads the result with `URL.createObjectURL(new Blob(...))`.

## Old Patch Execution Flow

Supported modules:

- `dpf`: PSA Delphi DCM7.1b DPF-Off, expected size `6,291,456`, `276` patches, optional checksum marker at `0x180184`.
- `egr`: PSA Delphi DCM7.1b EGR-Off, expected size `6,291,456`, `75` patches.
- `sid208`: PSA Siemens SID208 DPF+EGR Off, expected size `4,194,304`, `79` patches.
- `dtc`: universal stride-2 DTC table heuristic with all-off/all-on/apply controls.

Patch helpers:

- `hexToBytes`
- `bytesEq`
- `patchStatus`
- `applyPatches`
- `writeU32LE`
- `scanDtcTables`

Generated output names:

- `_DPF_off.bin`
- `_EGR_off.bin`
- `_DPF_EGR_off.bin`
- `_DTC_patched.bin`

## Payment And Access Restrictions

Legacy access gate:

- One `patcher_licenses` row per user.
- Status values: `pending`, `approved`, `rejected`.
- Price: `1,200 AED`.
- Customer submits a request with optional notes.
- Customer sends payment proof via WhatsApp.
- Admin approves/rejects in `admin.php`.

New platform mapping:

- `EcuPatcherAccess` Prisma model replaces `patcher_licenses`.
- `POST /api/ecu-patcher/access-requests` replaces the PHP POST form.
- `GET /api/ecu-patcher/access` feeds the frontend gate.
- `GET/PATCH /api/admin/ecu-patcher/access` provides admin/API visibility.

## New Integration Path

Fastest safe integration chosen:

1. Preserve the legacy module definitions and patch arrays.
2. Run patch execution in an isolated API route, not inside checkout/storefront code.
3. Store original file as a normal `BinUpload` so account upload history can show it.
4. Store patch job/result metadata in `EcuPatcherJob`.
5. Store generated result in existing object storage via `storeObject`.
6. Protect patch execution behind JWT auth and approved patcher access.
7. Keep `/ecu-patcher` as a customer-facing Next.js route.
8. Redirect `/ecu-patcher.php?lang=en` to `/ecu-patcher`.

## New Endpoints

- `GET /api/ecu-patcher/access`
- `POST /api/ecu-patcher/access-requests`
- `GET /api/ecu-patcher/jobs`
- `GET /api/ecu-patcher/jobs/:id`
- `POST /api/ecu-patcher/jobs`
- `GET /api/ecu-patcher/jobs/:id/download`
- `GET /api/admin/ecu-patcher/access`
- `PATCH /api/admin/ecu-patcher/access/:id`
- `GET /api/admin/ecu-patcher/jobs`

## Security Risks And Controls

Risks observed in legacy:

- Inline patch arrays and execution logic were exposed to every approved browser session.
- Browser-only output had no durable audit trail.
- Access approval existed only in PHP admin code.
- Downloads were local only, so support staff could not inspect job metadata.

Controls added:

- JWT/RBAC route protection.
- Approved customer access required before job creation.
- Admin/staff can view patcher access and job metadata through API.
- Original and result SHA256 hashes recorded.
- Job status, logs, patch counts, checksum status, and result object metadata recorded.
- Audit logs written for access requests, job processing, and result downloads.
- Patcher API is isolated from shop checkout, catalog, worker queues, and ECU corpus ingestion.

## Scope Notes

- Storefront, checkout, product catalog, Docker, BullMQ, worker runtime, and ECU corpus ingestion were not redesigned.
- The legacy DTC module had per-row browser toggles. The first migration supports the legacy all-off backend action for detected table candidates and stores the resulting job metadata.
- Result generation is synchronous and isolated from checkout. A failed patcher job does not affect storefront operations.

## Validation Results

Validation date: 2026-05-25

- Prisma schema validation: passed.
- Prisma migration deploy: passed; migration `20260525162000_legacy_ecu_patcher_workflow` applied to local PostgreSQL.
- Prisma client generation: passed.
- API type-check and build: passed.
- Web type-check and production build: passed.
- Runtime API flow: passed with a temporary customer account, approved `EcuPatcherAccess`, synthetic DCM7.1b BIN upload, completed patch job, persisted `EcuPatcherJob`, linked `BinUpload`, result download, and admin job visibility.
- Patch execution check: passed; downloaded result contained the expected patched bytes at the legacy patch offset and recorded checksum marker application.
- Invalid upload validation: passed; `.txt` upload was rejected with HTTP `400` and a structured response containing `meta.requestId`.
- Structured response/request ID check: passed for register, patch job creation, and invalid upload rejection.
- Legacy redirect check: passed; `GET /ecu-patcher.php?lang=en` returns HTTP `301` with `Location: /ecu-patcher`.
- Mobile route smoke check: passed on `390x844`; `/ecu-patcher` rendered the restored patcher page with no browser console errors.
