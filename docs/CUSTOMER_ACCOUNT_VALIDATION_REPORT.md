# Customer Account Validation Report

Date: 2026-05-25

Scope: customer-facing authentication and legacy commercial account restoration.

## Implemented Surface

- Public auth pages: `/login`, `/register`, `/forgot-password`, `/reset-password`.
- Protected account pages: `/account`, `/account/orders`, `/account/inquiries`, `/account/uploads`, `/account/settings`.
- Legacy commercial redirects restored:
  - `/login.php` -> `/login`
  - `/register.php` -> `/register`
  - `/client_panel.php` -> `/account` protected flow, redirecting unauthenticated visitors to `/login?returnTo=/account`.
- Customer session restoration uses existing JWT access tokens, refresh token rotation, secure refresh cookie support, and a non-sensitive storefront cookie marker for middleware gating.
- Customer history is recovered by email/user association for orders, quote requests, product inquiries, and BIN uploads.
- Checkout now attaches a logged-in customer token so new orders can persist `userId` and account contact details.

## Runtime Validation

Command used:

```bash
pnpm --filter @caracal/api migrate:deploy
pnpm --filter @caracal/api prisma:generate
pnpm --filter @caracal/api type-check
pnpm --filter @caracal/web type-check
pnpm --filter @caracal/api build
pnpm --filter @caracal/web build
pnpm --filter @caracal/api test
pnpm --filter @caracal/web test
cd apps/api
pnpm exec tsx scripts/validate-customer-account-runtime.ts
```

Validation script: `apps/api/scripts/validate-customer-account-runtime.ts`.

Results:

- Protected `/api/account/summary` without token returned `401`.
- `POST /api/auth/register` created a `customer` role user.
- `POST /api/auth/refresh` rotated the refresh token.
- `GET /api/auth/session` restored the customer session from JWT.
- `PATCH /api/account/profile` persisted name, phone, company, and workshop profile fields.
- `POST /api/quote-requests` created a visible quote request.
- `POST /api/product-inquiries` created a visible product inquiry.
- `POST /api/bin-uploads` stored a visible synthetic BIN upload with `BIN_ANALYSIS_AUTO_QUEUE=false`.
- A synthetic paid order was inserted through Prisma and appeared in `/api/account/orders`.
- `/api/account/summary` returned counts: orders `1`, quote requests `1`, product inquiries `1`, uploads `1`.
- `/api/account/inquiries` and `/api/account/uploads` returned the expected customer records.
- `POST /api/auth/forgot-password` issued a reset token in local validation mode.
- `POST /api/auth/reset-password` reset the password and revoked previous refresh tokens.
- `POST /api/auth/login` worked with the new password.
- `POST /api/auth/logout` cleared the active refresh session.
- Structured API envelopes included request IDs on validated responses.
- Audit rows were observed for register, password reset, quote request, product inquiry, BIN upload, profile update, and account history reads.
- Synthetic validation records were cleaned up after the run; follow-up DB check returned zero validation users/orders/quotes/inquiries/uploads.

## Browser Validation

Browser target: `http://127.0.0.1:3000`.

Mobile viewport: `390x844`.

Results:

- `/login` rendered expected customer login copy and links with no horizontal overflow.
- `/register` rendered customer registration and workshop/company fields with no horizontal overflow.
- `/forgot-password` rendered account recovery flow with no horizontal overflow.
- `/reset-password` rendered reset form with no horizontal overflow.
- `/account` redirected unauthenticated visitors to `/login?returnTo=%2Faccount`.
- Legacy URLs `/login.php`, `/register.php`, and `/client_panel.php` resolved to the restored customer account flow.

## Build Notes

- API type-check and build passed.
- Web type-check and production build passed.
- API tests passed: 1 file, 8 tests.
- Web tests passed with no test files present.
- The web build still reports pre-existing ESLint warnings in `apps/web/src/lib/api/admin-client.ts` for `@typescript-eslint/consistent-type-imports`; no customer-account build errors were introduced.

## Remaining Operational Note

Password reset token generation and reset pages are implemented. Production email delivery for reset links still depends on wiring the chosen transactional email provider and should not expose reset URLs outside local/non-production validation.
