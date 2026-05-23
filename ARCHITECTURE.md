# Caracal Tech Motors - Repository Architecture Guide

## 1. Repository Decision: Monorepo

### ✅ Why Monorepo?

**Benefits:**
- **Shared Types & Utilities** — Single source of truth for TypeScript types, validation rules, and utilities across frontend, backend, and services
- **Coordinated Releases** — Deploy frontend and API together; ensure compatibility
- **Atomic Commits** — Feature touching both frontend and backend in one commit with one PR
- **DRY Principle** — No duplicated code across separate repos
- **Easier Refactoring** — Change shared logic once, not per-repo
- **Simplified CI/CD** — One workflow pipeline, no cross-repo coordination
- **Single Security Scanning** — Dependabot, SAST, and licensing checks in one place

**Trade-offs addressed:**
- **Monorepo bloat** → Use Turborepo to only rebuild changed packages
- **Slower CI** → Caching + parallel tasks mitigates this
- **Permission control** → GitHub teams + CODEOWNERS file
- **Repo size** → Shallow clones + git hooks keep it lean

### Tools & Setup

**Package Manager:** `pnpm` (faster, better disk space)
```bash
pnpm install
pnpm -r add lodash  # Add to all packages
pnpm --filter @caracal/types add axios
```

**Workspace Orchestration:** `Turborepo`
```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "cache": true
    }
  }
}
```

---

## 2. Folder Structure (Complete)

```
caracal-tech-motors/
├── 📁 apps/
│   │
│   ├── web/                           # Next.js 15 Frontend
│   │   ├── src/
│   │   │   ├── app/                  # App Router (Next.js 13+)
│   │   │   │   ├── dashboard/        # /dashboard
│   │   │   │   ├── tool-store/       # /tool-store
│   │   │   │   ├── workshop/         # /workshop
│   │   │   │   ├── consulting/       # /consulting
│   │   │   │   ├── account/          # /account
│   │   │   │   ├── auth/             # /auth
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── dashboard/        # Dashboard UI components
│   │   │   │   ├── tool-store/       # Tool store components
│   │   │   │   ├── workshop/         # Workshop portal components
│   │   │   │   ├── shared/           # Reusable: Header, Nav, Footer
│   │   │   │   ├── forms/            # Form components
│   │   │   │   └── icons/            # Custom SVG icons
│   │   │   │
│   │   │   ├── lib/
│   │   │   │   ├── api.ts            # API client (fetch wrapper)
│   │   │   │   ├── hooks/            # Custom React hooks
│   │   │   │   │   ├── useAuth.ts
│   │   │   │   │   ├── useDashboard.ts
│   │   │   │   │   └── useToolStore.ts
│   │   │   │   ├── utils/            # Helpers (formatters, validators)
│   │   │   │   └── constants.ts
│   │   │   │
│   │   │   ├── styles/
│   │   │   │   ├── globals.css
│   │   │   │   └── variables.css
│   │   │   │
│   │   │   └── types/                # Local types (extend @caracal/types)
│   │   │       └── index.ts
│   │   │
│   │   ├── public/
│   │   │   ├── images/
│   │   │   ├── icons/
│   │   │   └── fonts/
│   │   │
│   │   ├── __tests__/
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   └── e2e/                  # Playwright tests
│   │   │
│   │   ├── .env.local                # Git ignored
│   │   ├── .env.example
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   ├── jest.config.js
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api/                           # Node.js Backend (Express/Fastify)
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── auth.routes.ts     # POST /auth/login, /auth/register
│   │   │   │   ├── dashboard.routes.ts
│   │   │   │   ├── workshop.routes.ts
│   │   │   │   ├── tool-store.routes.ts
│   │   │   │   ├── consulting.routes.ts
│   │   │   │   ├── bin-upload.routes.ts
│   │   │   │   └── health.routes.ts
│   │   │   │
│   │   │   ├── controllers/
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── workshop.controller.ts
│   │   │   │   ├── tool-store.controller.ts
│   │   │   │   ├── bin-upload.controller.ts
│   │   │   │   └── consulting.controller.ts
│   │   │   │
│   │   │   ├── services/              # Business logic
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── workshop.service.ts
│   │   │   │   ├── tool-store.service.ts
│   │   │   │   ├── consulting.service.ts
│   │   │   │   ├── bin-upload.service.ts
│   │   │   │   └── email.service.ts
│   │   │   │
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.ts
│   │   │   │   ├── error-handler.ts
│   │   │   │   ├── validation.ts
│   │   │   │   └── logging.ts
│   │   │   │
│   │   │   ├── models/                # Database models (Prisma)
│   │   │   │   ├── user.ts
│   │   │   │   ├── workshop.ts
│   │   │   │   ├── tool.ts
│   │   │   │   ├── consulting-session.ts
│   │   │   │   └── bin-file.ts
│   │   │   │
│   │   │   ├── utils/
│   │   │   │   ├── jwt.ts
│   │   │   │   ├── encryption.ts
│   │   │   │   └── validators.ts
│   │   │   │
│   │   │   ├── config/
│   │   │   │   └── database.ts
│   │   │   │
│   │   │   ├── app.ts                 # App setup
│   │   │   └── server.ts              # Entry point
│   │   │
│   │   ├── migrations/                # Prisma migrations
│   │   │   ├── 001_init.sql
│   │   │   └── 002_add_workshops.sql
│   │   │
│   │   ├── seeds/
│   │   │   └── seed.ts                # Database seeding
│   │   │
│   │   ├── __tests__/
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   └── fixtures/
│   │   │
│   │   ├── .env.local
│   │   ├── .env.example
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── jest.config.js
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── Dockerfile
│   │
│   ├── workshop-portal/               # React app for workshop managers
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   └── ...
│   │   └── package.json
│   │
│   └── consulting-dashboard/          # Admin/consulting panel
│       ├── src/
│       ├── components/
│       └── ...
│
├── 📁 packages/                       # Shared libraries
│   │
│   ├── @caracal/types/                # TypeScript types
│   │   ├── src/
│   │   │   ├── api.ts                 # API request/response types
│   │   │   ├── database.ts            # DB entity types
│   │   │   ├── workshop.ts
│   │   │   ├── tool-store.ts
│   │   │   ├── consulting.ts
│   │   │   ├── bin-upload.ts
│   │   │   ├── auth.ts
│   │   │   └── index.ts               # Barrel export
│   │   │
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   │
│   ├── @caracal/utils/                # Shared utilities
│   │   ├── src/
│   │   │   ├── crypto.ts              # Encryption/hashing
│   │   │   ├── validation.ts          # Input validation
│   │   │   ├── file-upload.ts         # File handling
│   │   │   ├── logger.ts              # Logging
│   │   │   ├── formatters.ts          # Data formatters
│   │   │   └── index.ts
│   │   │
│   │   ├── __tests__/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── @caracal/db/                   # Database client
│   │   ├── src/
│   │   │   ├── client.ts              # Prisma client
│   │   │   ├── schema.ts              # Prisma schema (symlink or copy)
│   │   │   ├── migrations/
│   │   │   └── index.ts
│   │   │
│   │   ├── prisma/
│   │   │   ├── schema.prisma          # Source of truth
│   │   │   └── migrations/
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── @caracal/config/               # Shared configuration
│   │   ├── src/
│   │   │   ├── env.ts                 # ENV validation schema (zod)
│   │   │   ├── constants.ts           # App constants
│   │   │   ├── feature-flags.ts       # Feature flags
│   │   │   └── index.ts
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── @caracal/auth/                 # Auth utilities
│       ├── src/
│       │   ├── jwt.ts                 # JWT creation/verification
│       │   ├── session.ts             # Session management
│       │   ├── permissions.ts         # Permission checks
│       │   ├── role-based-access.ts
│       │   └── index.ts
│       │
│       ├── __tests__/
│       ├── package.json
│       └── tsconfig.json
│
├── 📁 .github/
│   │
│   ├── workflows/
│   │   ├── ci.yml                     # Lint, test, build on PR
│   │   ├── cd.yml                     # Deploy to staging on develop merge
│   │   ├── prod-release.yml           # Production release on main tag
│   │   ├── db-migrate.yml             # Run migrations on production
│   │   ├── security-scan.yml          # Dependabot, CodeQL, SAST
│   │   └── cron-cleanup.yml           # Scheduled tasks
│   │
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── task.md
│   │
│   ├── PULL_REQUEST_TEMPLATE.md
│   │
│   └── CODEOWNERS                     # Code ownership rules
│
├── 📁 docker/
│   ├── Dockerfile.api                 # Node.js API
│   ├── Dockerfile.web                 # Next.js frontend
│   ├── docker-compose.yml             # Local dev environment
│   └── docker-compose.prod.yml
│
├── 📁 docs/
│   ├── SETUP.md                       # Getting started
│   ├── ARCHITECTURE.md                # This file
│   ├── API.md                         # API documentation
│   ├── DATABASE.md                    # DB schema & migrations
│   ├── DEPLOYMENT.md                  # Deployment procedures
│   └── CONTRIBUTING.md                # Contribution guidelines
│
├── 📁 scripts/
│   ├── setup.sh                       # Dev environment setup
│   ├── migrate.sh                     # Run migrations
│   └── docker-build.sh
│
├── .env.example                       # Template for all ENV vars
├── .env.local                         # Git ignored - local development
├── .gitignore
├── .editorconfig
├── turbo.json                         # Turborepo configuration
├── pnpm-workspace.yaml                # Workspace definition
├── pnpm-lock.yaml                     # Dependency lock file
├── package.json                       # Root workspace package
├── tsconfig.json                      # Root TypeScript config
├── tsconfig.base.json                 # Base config (referenced by all)
├── eslint.config.js
├── prettier.config.js
├── jest.config.js
├── vitest.config.ts
├── README.md
├── LICENSE
└── SECURITY.md                        # Security policy
```

---

## 3. Naming Conventions

### Branch Names

```
Feature:          feature/tool-store-ui
                  feature/workshop-accounts-management
                  feature/bin-upload-parser

Bugfix:           bugfix/dashboard-loading-error
                  bugfix/workshop-email-validation

Hotfix:           hotfix/auth-critical-bug
                  hotfix/database-connection-pool

Documentation:    docs/api-endpoints
                  docs/deployment-guide

Chore:            chore/upgrade-dependencies
                  chore/optimize-build
```

### Commit Messages

```
Format: <type>(<scope>): <subject> [<issue-ref>]

Types:
  feat      - New feature
  fix       - Bug fix
  refactor  - Code refactoring
  test      - Test additions or updates
  docs      - Documentation
  chore     - Build, deps, config
  ci        - CI/CD changes
  perf      - Performance improvement
  style     - Code style (formatting, missing semicolons, etc)

Scopes (use exactly):
  api         - Backend API
  web         - Frontend (Next.js)
  workshop    - Workshop portal
  consulting  - Consulting dashboard
  db          - Database schema/migrations
  auth        - Authentication
  toolstore   - Tool store feature
  bin-upload  - BIN file upload
  config      - Configuration
  ci          - CI/CD workflows
  deps        - Dependencies

Examples:
  feat(toolstore): add BIN file validation #123
  fix(api): resolve workshop account creation timeout #456
  refactor(web): extract dashboard header component
  test(db): add migration tests for user schema
  docs(api): update REST endpoint documentation
  chore(deps): upgrade typescript to 5.3.0
  ci(cd): add staging deployment approval gate
  perf(web): optimize dashboard bundle size by 15%
```

### File & Folder Names

```
Files:
  camelCase for .ts, .tsx files
  PascalCase for React components (Button.tsx, UserCard.tsx)
  kebab-case for CSS modules (dashboard.module.css)
  UPPERCASE for constants (COLORS.ts, API_ENDPOINTS.ts)

Folders:
  lowercase for all folders
  plural for collections (components/, utils/, services/)
  descriptive names (auth/, tool-store/, workshop/)

Database:
  snake_case for tables and columns
  Prefix with context if needed (workshop_members, consulting_sessions)
```

### Package Names

```
@caracal/types       - Shared TypeScript types
@caracal/utils       - Utilities and helpers
@caracal/db          - Database client
@caracal/config      - Configuration and constants
@caracal/auth        - Authentication helpers
@caracal/ui          - Shared UI components (if created later)
```

---

## 4. Environment Variable Strategy

### Structure

```
# Root .env.example (template for all environments)

# === Core ===
NODE_ENV=development
APP_NAME=caracal-tech-motors
APP_VERSION=0.1.0

# === Database ===
DATABASE_URL=postgresql://user:password@localhost:5432/caracal_dev
DATABASE_REPLICA_URL=postgresql://readonly:password@localhost:5432/caracal_dev

# === API ===
API_PORT=3001
API_HOST=localhost
API_PUBLIC_URL=http://localhost:3001

# === Frontend ===
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000

# === Authentication ===
JWT_SECRET=dev-secret-change-in-production
JWT_EXPIRY=24h
REFRESH_TOKEN_SECRET=dev-refresh-secret
REFRESH_TOKEN_EXPIRY=7d

# === Storage ===
STORAGE_TYPE=local|s3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=caracal-tools
AWS_REGION=us-east-1

# === BIN Upload ===
BIN_UPLOAD_MAX_SIZE=52428800  # 50MB
BIN_UPLOAD_ALLOWED_TYPES=.bin,.hex,.elf

# === Email ===
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM=noreply@caracaltechmotors.com

# === Feature Flags ===
FEATURE_CONSULTING_ENABLED=true
FEATURE_WORKSHOP_ADMIN=true
FEATURE_BETA_TOOLS=false

# === Logging ===
LOG_LEVEL=info
LOG_FORMAT=json|text
SENTRY_DSN=

# === Security ===
RATE_LIMIT_WINDOW=900  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# === External Services ===
STRIPE_PUBLIC_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

### Environment-Specific Files

```
.env.local           # Git ignored - local development (highest priority)
.env.development     # Dev environment (committed)
.env.staging         # Staging (committed, secrets in CI/CD)
.env.production      # Production (never committed, all secrets in CI/CD)
.env.example         # Template (committed, all public values)
```

### Loading Strategy (Backend)

```typescript
// apps/api/src/config/env.ts
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  API_PORT: z.coerce.number().default(3001),
  // ... more fields
})

const env = envSchema.parse(process.env)
export default env
```

### Loading Strategy (Frontend)

```typescript
// apps/web/src/lib/env.ts
// Only NEXT_PUBLIC_* vars available on client

const env = {
  API_URL: process.env.NEXT_PUBLIC_API_URL,
  APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  // Static values, no process.env in client code
} as const

export default env
```

### CI/CD Secrets Management

**GitHub Secrets:**
```
- API_JWT_SECRET (GitHub Actions reads this for .env creation)
- DATABASE_URL_PRODUCTION
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- STRIPE_SECRET_KEY
```

**Workflow Pattern:**
```yaml
- name: Create .env for deployment
  run: |
    echo "DATABASE_URL=${{ secrets.DATABASE_URL_PRODUCTION }}" >> .env.production
    echo "JWT_SECRET=${{ secrets.API_JWT_SECRET }}" >> .env.production
```

---

## 5. Git Workflow (Step-by-Step)

### Starting a Feature

```bash
# Update develop
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/tool-store-bom-analysis

# Make commits
git add .
git commit -m "feat(toolstore): parse BIN file structure"
git commit -m "feat(toolstore): add BOM extraction logic"
git commit -m "test(toolstore): add BIN parsing tests"
```

### Creating a Pull Request

```bash
# Push branch
git push origin feature/tool-store-bom-analysis

# Create PR on GitHub (using template)
# - Title: "feat(toolstore): add BOM extraction from BIN files"
# - Body: (auto-filled from template)
#   - Description
#   - Testing steps
#   - Screenshots/recordings
#   - Linked issues
```

### Code Review Cycle

```bash
# Reviewer requests changes
# Author makes updates locally

git add .
git commit -m "refactor(toolstore): improve error handling in BOM parser"
git push origin feature/tool-store-bom-analysis

# Repeat until approved
```

### Merging & Deployment

```bash
# Merge to develop (squash commits for cleaner history)
git checkout develop
git pull origin develop
git merge --squash feature/tool-store-bom-analysis
git commit -m "feat(toolstore): add BOM extraction from BIN files (#123)"

# Push (triggers staging deploy)
git push origin develop

# Delete feature branch
git push origin --delete feature/tool-store-bom-analysis
git branch -d feature/tool-store-bom-analysis
```

### Production Release

```bash
# Create release branch from main
git checkout main
git pull origin main
git checkout -b release/v1.0.0

# Bump version, update CHANGELOG
# Commit: "chore: release v1.0.0"

git push origin release/v1.0.0

# Create PR, merge, tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Triggers prod deployment + creates release notes
```

---

## 6. PR Structure & Review Process

### PR Template (.github/PULL_REQUEST_TEMPLATE.md)

```markdown
## Description
Brief explanation of changes and why they're needed.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123
Related to #456

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing
- [ ] Added unit tests
- [ ] Added integration tests
- [ ] Manual testing completed

## Testing Steps
1. Step 1
2. Step 2
3. Expected result

## Screenshots / Recordings
(if applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally
- [ ] Tested in staging environment
```

### Review Requirements

```yaml
# .github/CODEOWNERS
* @caracal-core-team

apps/api/ @caracal-backend-team
apps/web/ @caracal-frontend-team
packages/ @caracal-core-team

# Require reviews
branch_protection_rule:
  require_code_reviews: true
  required_approvers: 2
  dismiss_stale_reviews: true
  require_status_checks: true
```

---

## 7. Deployment Strategy

### Environments

```
Local (developer machine)
   ↓
Staging (develop branch)
   ↓ (manual approval)
Production (main branch / git tags)
```

### Staging Deployment (Automatic)

```yaml
# .github/workflows/cd.yml
on:
  push:
    branches: [develop]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel (web)
        run: vercel --prod
      - name: Deploy to Railway (api)
        run: railway up --environment staging
      - name: Run migrations
        run: npm run migrate:staging
      - name: Seed if needed
        run: npm run seed:staging
```

### Production Deployment (Manual with Approval)

```yaml
on:
  push:
    tags:
      - 'v*'

jobs:
  deploy-production:
    runs-on: ubuntu-latest
    environment: production  # Requires approval
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel (web)
        run: vercel --prod --environment production
      - name: Deploy to Railway (api)
        run: railway up --environment production
      - name: Run migrations
        run: npm run migrate:production
      - name: Run health check
        run: npm run health-check
      - name: Notify team
        run: curl -X POST ${{ secrets.SLACK_WEBHOOK }}
```

---

## 8. CI/CD Architecture

### Pipeline Stages

```
1. LINT & FORMAT
   ├─ ESLint (all packages)
   ├─ Prettier check
   └─ Type check (tsc)

2. BUILD
   ├─ Build all packages
   └─ Artifact upload

3. TEST
   ├─ Unit tests (Jest)
   ├─ Integration tests
   └─ Coverage report

4. SECURITY
   ├─ Dependabot (dependencies)
   ├─ CodeQL (code analysis)
   ├─ SAST (SonarQube)
   └─ License compliance

5. DEPLOY (if all pass)
   └─ Staging/Production

6. POST-DEPLOY
   ├─ Smoke tests
   ├─ Performance audit
   └─ Slack notification
```

### Workflow Files

**apps/api/.env.ci**
```
DATABASE_URL=postgresql://test:test@postgres:5432/caracal_test
NODE_ENV=test
JWT_SECRET=test-secret-min-32-chars-required
```

**apps/web/.env.ci**
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 9. Issue Labeling System

### Label Categories

**Type Labels**
- `🐛 bug` — #E24B4A (Red)
- `✨ feature` — #639922 (Green)
- `🔄 refactor` — #888780 (Gray)
- `🩹 chore` — #BA7517 (Amber)
- `📚 documentation` — #185FA5 (Blue)
- `🔒 security` — #A32D2D (Dark Red)
- `♻️ dependencies` — #0F6E56 (Teal)

**Priority Labels**
- `🔴 critical` — #A32D2D (Red) - Production down
- `🟠 high` — #BA7517 (Orange) - Major feature/bug
- `🟡 medium` — #EF9F27 (Amber) - Normal priority
- `🟢 low` — #3B6D11 (Green) - Nice to have

**Status Labels**
- `📌 backlog` — #0F6E56 (Teal) - Not yet planned
- `⏳ ready` — #185FA5 (Blue) - Ready to start
- `🚀 in-progress` — #1D9E75 (Green) - Someone working
- `🔍 review` — #D4537E (Pink) - In code review
- `🎉 done` — #3B6D11 (Dark Green) - Completed

**Area Labels**
- `api` — #185FA5 (Blue)
- `web` — #D4537E (Pink)
- `workshop` — #BA7517 (Amber)
- `toolstore` — #1D9E75 (Teal)
- `consulting` — #534AB7 (Purple)
- `db` — #0F6E56 (Dark Teal)
- `devops` — #888780 (Gray)

**Other**
- `🔄 duplicate` — Gray
- `❓ question` — Blue
- `🤝 help-wanted` — Green
- `good-first-issue` — Green

---

## 10. Code Ownership & Permissions

### CODEOWNERS

```
# .github/CODEOWNERS

# Core team reviews all PRs
* @caracal-core-team

# API changes
apps/api/ @caracal-backend-team
apps/api/migrations/ @caracal-dba-team

# Frontend changes
apps/web/ @caracal-frontend-team
apps/web/public/ @caracal-design-team

# Shared packages
packages/ @caracal-core-team

# Database
packages/@caracal/db/ @caracal-dba-team

# Security-sensitive
.github/workflows/ @caracal-security-team
packages/@caracal/auth/ @caracal-security-team
apps/api/src/middleware/auth.middleware.ts @caracal-security-team
```

### GitHub Teams

```
caracal-core-team
  - Lead engineer
  - Senior engineer
  - Tech lead

caracal-backend-team
  - Backend engineer
  - Backend engineer

caracal-frontend-team
  - Frontend engineer
  - Frontend engineer

caracal-dba-team
  - DBA specialist
  - Backend lead

caracal-security-team
  - Security engineer
  - Tech lead

caracal-design-team
  - Product designer
  - UX designer
```

---

## Summary: Day 1 Setup

```bash
# 1. Clone and install
git clone https://github.com/caracal-motors/caracal-tech-motors.git
cd caracal-tech-motors
pnpm install

# 2. Setup environment
cp .env.example .env.local
# Edit .env.local with your dev database URL

# 3. Create feature branch
git checkout -b feature/your-feature-name

# 4. Install pre-commit hooks
npx husky install

# 5. Run dev server
pnpm dev

# Navigate to http://localhost:3000 (frontend)
#              http://localhost:3001 (API)
```

This architecture scales from early beta to production while maintaining code quality and team velocity.
