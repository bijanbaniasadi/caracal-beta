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

## Database

- Start core services:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres redis
```

- Apply migrations:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api pnpm --filter @caracal/api migrate:deploy
```

- Generate Prisma client during build is automatic, but verify API health after deploy.

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

- Store database dumps and upload/log archives off-host after every backup.

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
- Restore code/image first, then apply only compatible database rollback steps manually.
- Do not reset the production database without a verified dump.
