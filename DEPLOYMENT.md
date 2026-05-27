# VPS Deployment Runbook

This project deploys to the production VPS from a git checkout at `/var/www/caracaltech`.
The production compose file is `docker-compose.prod.yml`, and the production env file is
`.env.production`. The env file lives only on the VPS, is gitignored, and must not be
overwritten by deploy scripts or committed.

## One-Time Bootstrap

Use this only while `/var/www/caracaltech` is still a manually copied directory and not a
git repository.

If the existing manual copy does not already contain the bootstrap script, copy it from a
trusted local checkout first:

```bash
scp scripts/vps-bootstrap.sh root@178.105.60.66:/var/www/caracaltech/scripts/vps-bootstrap.sh
```

```bash
ssh root@178.105.60.66
cd /var/www/caracaltech
bash scripts/vps-bootstrap.sh <git-remote-url> production-vps-fixes
```

The bootstrap script:

- Requires root on the VPS.
- Refuses to run if `/var/www/caracaltech/.git` already exists.
- Takes a custom-format Postgres dump at `/root/caracal_db_preclone_<timestamp>.dump`.
- Copies `/var/www/caracaltech/.env.production` to `/root/.env.production.vps-backup`.
- Stops containers with `docker compose down` without `-v`.
- Renames the current live directory to `/var/www/caracaltech-preclone-<timestamp>`.
- Clones the repo into `/var/www/caracaltech`, checks out the requested branch, restores
  `.env.production`, starts the stack with `up -d --build`, and verifies DB/user count plus
  localhost health.

If the script file is not executable after transfer, run:

```bash
chmod +x scripts/vps-bootstrap.sh scripts/vps-deploy.sh
```

## Repeatable Deploys

After bootstrap, deploy from the git checkout:

```bash
ssh root@178.105.60.66
cd /var/www/caracaltech
bash scripts/vps-deploy.sh production-vps-fixes
```

The deploy script:

- Refuses to run outside `/var/www/caracaltech`.
- Refuses to run if the directory is not a git repo.
- Refuses tracked-file drift before pulling. `.env.production` and `backups/` are allowed
  to be dirty.
- Takes a custom-format Postgres dump at `/root/caracal_db_predeploy_<timestamp>.dump`.
- Runs `git pull --ff-only origin <branch>`.
- Builds only `api` and `web`.
- Runs `pnpm --filter @caracal/api migrate:deploy` through the `api` service.
- Starts the stack with `docker compose up -d` and verifies localhost health.

## Data Safety Guarantees

The production compose file uses explicitly named Docker volumes:

- `caracal-postgres-data`
- `caracal-typesense-data`
- `caracal-redis-data`
- `caracal-api-uploads`
- `caracal-api-logs`
- `caracal-nginx-logs`
- `caracal-catalog-backups`

Because the volumes are named, data persists across directory renames and git checkout
replacement. The scripts never run `docker compose down -v` and never run `docker volume rm`.

The Typesense image is pinned to `typesense/typesense:30.2` in `docker-compose.prod.yml`.

## Rollback

For bootstrap rollback:

1. Stop the current git-checkout stack with `docker compose -f docker-compose.prod.yml --env-file .env.production down`.
2. Move `/var/www/caracaltech` aside.
3. Move `/var/www/caracaltech-preclone-<timestamp>` back to `/var/www/caracaltech`.
4. Start the previous stack with `docker compose -f docker-compose.prod.yml --env-file .env.production up -d`.
5. Restore `/root/caracal_db_preclone_<timestamp>.dump` only if the database itself needs rollback.

For repeatable deploy rollback:

1. Check out the previous known-good commit.
2. Manually run the same compose build/up sequence after confirming the checkout.
3. Restore `/root/caracal_db_predeploy_<timestamp>.dump` only if the database itself needs rollback.

## Backup Files in Git

`.gitignore` ignores `backups/**` while allowing `ROLLBACK_STATE.md` and
`FREEZE_METADATA.yaml` metadata files to remain trackable. Existing tracked backup binaries
can be untracked separately with `git rm --cached <path>`; do that in a dedicated cleanup
commit, not as part of deployment tooling.
