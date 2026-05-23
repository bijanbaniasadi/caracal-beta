# Local Development

This repository is stabilized for the documented pnpm/Turbo monorepo workflow.

## Runtime Requirements

- Node.js `>=20`
- pnpm `8.15.9`
- Git
- Docker Desktop, when using local PostgreSQL

Node.js includes Corepack. In this workspace, pnpm is pinned by the root `packageManager` field:

```json
"packageManager": "pnpm@8.15.9"
```

If pnpm is not available after installing Node.js, enable it with one of these options:

```powershell
corepack enable --install-directory "$env:APPDATA\npm"
corepack prepare pnpm@8.15.9 --activate
```

or install the pinned version for the current user:

```powershell
npm install --global pnpm@8.15.9
```

On Windows, if PowerShell blocks npm or pnpm shims, allow locally created scripts for the current user:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force
```

## Fresh Clone Boot

```bash
git clone https://github.com/bijjanbianiasadi/caracal-beta.git
cd caracal-beta
pnpm install
pnpm dev
```

`pnpm dev` starts:

- `@caracal/web` on `http://localhost:3000`
- `@caracal/api` on `http://localhost:3001`

Verify the API:

```bash
curl http://localhost:3001/health
```

## One-Command Setup

On Windows, this repository also includes:

```powershell
pnpm setup
```

The setup script:

- Adds common Node.js and npm user paths to the current shell session when needed
- Creates `.env.local` from `.env.example` if missing
- Installs workspace dependencies

Start the development servers with:

```powershell
pnpm start:dev
```

## Runtime Validation

Use these checks before pushing runtime changes:

```bash
pnpm install
pnpm --filter @caracal/api prisma:generate
pnpm lint
pnpm type-check
pnpm build
pnpm dev
```

## Workspace Notes

- Root workspace declarations live in `package.json` and `pnpm-workspace.yaml`.
- Turbo pipeline configuration lives in `turbo.json`.
- Shared packages are linked through `workspace:*` dependencies.
- Prisma schema lives at `apps/api/prisma/schema.prisma`.
- Next.js App Router files live at `apps/web/src/app`.
