# Production Deployment Checklist

## Environment

- Create `.env.production` from `.env.example`.
- Set `NODE_ENV=production`.
- Set `PUBLIC_SITE_URL` and `NEXT_PUBLIC_API_URL` to the public HTTPS origin.
- Set `CORS_ORIGINS` to the same HTTPS origin.
- Set strong `JWT_SECRET` and `REFRESH_TOKEN_SECRET` values with at least 32 characters.
- Set live Stripe keys:
  - `STRIPE_SECRET_KEY=sk_live_...`
  - `STRIPE_WEBHOOK_SECRET=whsec_...`
- Set PostgreSQL values:
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`
  - `POSTGRES_DB`
  - `DATABASE_URL=postgresql://USER:PASSWORD@postgres:5432/DB`
- Set catalog sync controls:
  - `CATALOG_SYNC_RATE_LIMIT_MAX=120`
  - `SUPPLIER_SYNC_USD_AED`
  - `SUPPLIER_SYNC_EUR_AED`
  - `SUPPLIER_SYNC_GBP_AED`
- For a 4GB VPS, keep runtime memory bounded unless metrics prove more headroom:
  - `WEB_NODE_OPTIONS=--max-old-space-size=512`
  - `API_NODE_OPTIONS=--max-old-space-size=768`
  - `WORKER_NODE_OPTIONS=--max-old-space-size=768`
  - `BIN_ANALYSIS_WORKER_CONCURRENCY=1`
- Run:

```bash
pnpm prod:env:check
```

## SSL And Nginx

- Place certificates in `docker/nginx/certs`:
  - `fullchain.pem`
  - `privkey.pem`
- Confirm `docker/nginx/conf.d/caracal.conf` has the correct server name before launch.
- Confirm ports 80 and 443 are open on the host.
- Confirm ACME challenge files can be served from `docker/nginx/certbot`.
- Confirm HTTPS headers after certificates are installed:

```bash
curl -I https://your-domain.com/health/live
```

Expected headers include `Strict-Transport-Security`, `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`.

## Database

- Start core services:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres redis
```

- Apply migrations:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api pnpm --filter @caracal/api migrate:deploy
```

- Confirm migration status:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api pnpm --filter @caracal/api exec prisma migrate status --schema=prisma/schema.prisma
```

- Generate Prisma client during build is automatic, but verify API health after deploy.

## Admin Catalog Sync

- Verify admin auth blocks anonymous access:

```bash
curl -i https://your-domain.com/api/admin/catalog/sync
```

Expected: `401` or `403`.

- Verify after admin login:
  - `/admin/catalog/sync` renders pending rows.
  - Price diff shows current production price next to staged AED price.
  - Price changes over 20% are highlighted.
  - Single approve/reject updates staging status.
  - Bulk approve/reject updates all selected staging rows.
  - Approve upserts into `Product` and writes `CatalogApprovalLog`.
  - Duplicate detection checks SKU, OEM number, and normalized title before publish.
  - Mobile viewport keeps the admin chrome compact and table scroll contained.

## Stripe

- Configure the Stripe webhook endpoint:

```text
https://your-domain.com/api/checkout/webhook/stripe
```

- Subscribe to:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `payment_intent.canceled`
  - `charge.refunded`
  - `refund.created`
  - `refund.updated`
  - `refund.failed`

## Launch

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

- Verify:
  - `https://your-domain.com/health/live`
  - `https://your-domain.com/health/ready`
  - `https://your-domain.com/shop`
  - `https://your-domain.com/shop/cart`
  - `https://your-domain.com/shop/checkout`
  - `https://your-domain.com/admin/orders`

## Payment Smoke Test

- Create a small test order in Stripe test mode before switching to live keys.
- Confirm an `Order` row is created before redirecting to Stripe Checkout.
- Confirm webhook delivery updates payment status to `PAID`.
- Confirm `/api/checkout/stripe-session/:sessionId` validates amount, currency, and order ID.
- Confirm admin order list shows payment, fulfillment, refund, and customer details.
- Confirm cancel releases reserved inventory for unpaid orders.
- Confirm refund request creates a Stripe refund and sets refund state to requested.

## Backups

- Windows host:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup-production.ps1
```

- Linux host:

```bash
sh scripts/backup-production.sh
```

- Linux automation:

```bash
sudo APP_DIR=/var/www/caracaltech BACKUP_DIR=/var/backups/caracaltech sh scripts/install-production-backup-cron.sh
```

- Store database dumps, upload archives, log archives, `.env.production`, nginx
  config, and compose-file backups off-host after every backup.

## Backup Restore

- Stop app services but keep PostgreSQL available:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml stop web api api-worker nginx
```

- Restore PostgreSQL:

```bash
cat backups/postgres-YYYYMMDDTHHMMSSZ.sql | docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

- Restore uploads:

```bash
docker run --rm -v caracal-api-uploads:/data -v "$(pwd)/backups:/backup" alpine:3.20 sh -c 'rm -rf /data/* && tar -xzf /backup/api-uploads-YYYYMMDDTHHMMSSZ.tgz -C /data'
```

- Restore config archive manually, then restart:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

## Logs And Monitoring

- API, worker, web, nginx, PostgreSQL, and Redis containers use bounded json-file logs.
- Payment, checkout, and webhook failures are emitted through structured API logs with `component=payments`.
- `/metrics` is proxied only for private network ranges in nginx.
- Review logs after deploy:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api api-worker nginx
```

## Rollback

- Keep the previous image tag or commit SHA available.
- Before rollback, take a backup with the scripts above.
- Restore code first:

```bash
git fetch origin
git checkout <previous-good-sha>
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

- Apply only compatible database rollback steps manually. Prisma migrations are
  forward-only in normal operation; use a database dump if a destructive rollback
  is unavoidable.
- Do not reset the production database without a verified dump.
