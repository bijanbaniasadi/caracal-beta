# Caracal Tech Motors

Development monorepo for the Caracal Tech Motors beta platform.

## Quick Start

### Prerequisites

- Node.js 20.x
- pnpm 8.x
- Docker and Docker Compose
- Git

### Setup

```bash
pnpm setup
```

The setup script copies `.env.example` to `.env.local` when needed and installs workspace dependencies.

For a fresh clone with Node.js and pnpm already available:

```bash
pnpm install
pnpm dev
```

### Start Development

```bash
pnpm dev
```

Default local services:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- API health: `http://localhost:3001/health`

Run individual apps:

```bash
pnpm dev:web
pnpm dev:api
```

### Database

Start local PostgreSQL:

```bash
docker compose up -d postgres
```

Run migrations:

```bash
pnpm db:migrate
```

### Common Checks

```bash
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

## Repository Structure

```text
apps/
  api/                 Express API scaffold
  web/                 Next.js frontend scaffold
packages/
  @caracal/auth/       Auth utilities
  @caracal/config/     Shared config helpers
  @caracal/db/         Database helpers
  @caracal/types/      Shared TypeScript types
  @caracal/utils/      Shared utilities
.github/
  ISSUE_TEMPLATE/      GitHub issue templates
  workflows/           CI/CD workflows
scripts/               Local setup and startup scripts
docker/                Docker build files
```

## Workflow

Branch prefixes:

- `feature/*`
- `bugfix/*`
- `hotfix/*`
- `chore/*`
- `docs/*`

Commit format:

```text
<type>(<scope>): <subject>
```

Examples:

```text
feat(toolstore): add BIN file validation
fix(api): resolve workshop account creation timeout
docs(web): update dashboard quickstart
```

See `CONTRIBUTING.md`, `ARCHITECTURE.md`, and `CONFIG_REFERENCE.md` for the full project conventions.
See `docs/LOCAL_DEVELOPMENT.md` for runtime setup and troubleshooting.
