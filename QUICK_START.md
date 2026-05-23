# Caracal Tech Motors - Quick Start Guide

## 📋 Prerequisites

- Node.js 20.x
- pnpm 8.x
- Docker & Docker Compose
- PostgreSQL (or use Docker)
- Git

## 🚀 Setup (5 minutes)

### 1. Clone Repository

```bash
git clone https://github.com/caracal-motors/caracal-tech-motors.git
cd caracal-tech-motors
```

### 2. Install Dependencies

```bash
# Install pnpm if needed
npm install -g pnpm@8

# Install all workspace dependencies
pnpm install
```

### 3. Setup Environment

```bash
# Copy example env file
cp .env.example .env.local

# Edit with your local database URL
nano .env.local
# DATABASE_URL=postgresql://user:password@localhost:5432/caracal_dev

# (Optional) Setup local PostgreSQL with Docker
docker-compose up -d postgres
```

### 4. Database Setup

```bash
# Run migrations
cd apps/api
npx prisma migrate deploy

# Seed database (optional)
npx prisma db seed

# View database with Prisma Studio
npx prisma studio
```

### 5. Install Git Hooks

```bash
npx husky install
```

### 6. Start Development Servers

```bash
# From root directory
pnpm dev

# This starts:
# - Frontend: http://localhost:3000
# - API: http://localhost:3001
```

---

## 📁 Repository Structure Quick Reference

```
caracal-tech-motors/
├── apps/
│   ├── web/                 # Next.js frontend
│   ├── api/                 # Node.js backend
│   ├── workshop-portal/     # Workshop manager app
│   └── consulting-dashboard/# Admin/consulting panel
│
├── packages/
│   ├── @caracal/types/      # Shared TypeScript types
│   ├── @caracal/utils/      # Shared utilities
│   ├── @caracal/db/         # Database client
│   ├── @caracal/config/     # Configuration
│   └── @caracal/auth/       # Auth utilities
│
├── .github/
│   ├── workflows/           # GitHub Actions CI/CD
│   ├── ISSUE_TEMPLATE/      # Issue templates
│   └── PULL_REQUEST_TEMPLATE.md
│
└── docs/
    ├── ARCHITECTURE.md      # This architecture guide
    ├── API.md              # API documentation
    ├── DATABASE.md         # Database schema
    └── DEPLOYMENT.md       # Deployment guide
```

---

## 🔄 Git Workflow

### Creating a Feature Branch

```bash
# 1. Update develop branch
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/your-feature-name

# 3. Make commits
git add .
git commit -m "feat(scope): description"

# 4. Push and create PR
git push origin feature/your-feature-name

# On GitHub: Create PR from feature branch to develop
```

### Branch Naming

```
feature/tool-store-ui
feature/workshop-accounts-management
bugfix/dashboard-loading-error
hotfix/critical-auth-bug
chore/upgrade-dependencies
docs/api-endpoints
```

### Commit Message Format

```
<type>(<scope>): <subject>

Types:  feat, fix, refactor, test, docs, chore, ci, perf, style
Scopes: api, web, workshop, consulting, db, auth, toolstore, bin-upload

Examples:
feat(toolstore): add BIN file validation
fix(api): resolve workshop account creation timeout
test(db): add migration tests for user schema
```

---

## 🧪 Testing

### Run All Tests

```bash
pnpm test
```

### Run Tests by Workspace

```bash
# Frontend tests
pnpm --filter web test

# API tests
pnpm --filter api test

# Specific package
pnpm --filter @caracal/utils test
```

### Test Coverage

```bash
pnpm test:coverage
```

### E2E Tests (Playwright)

```bash
# Run headless
pnpm --filter web test:e2e

# Run with UI
pnpm --filter web test:e2e --ui
```

---

## 🔨 Build & Production

### Build All Packages

```bash
pnpm build
```

### Build Specific App

```bash
# Build frontend
pnpm --filter web build

# Build API
pnpm --filter api build
```

### Production Build Preview

```bash
pnpm --filter web build
pnpm --filter web start
```

---

## 🧹 Code Quality

### Lint All Code

```bash
pnpm lint
```

### Auto-fix Lint Issues

```bash
pnpm lint:fix
```

### Format Code

```bash
# Check formatting
pnpm format:check

# Auto-format
pnpm format
```

### Type Check

```bash
pnpm type-check
```

---

## 🐳 Docker Development

### Start All Services

```bash
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Services Running

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379` (if added)
- Frontend: `localhost:3000`
- API: `localhost:3001`

---

## 🔑 Environment Variables

### Essential for Development

```
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/caracal_dev

# Auth
JWT_SECRET=dev-secret-at-least-32-characters-long
REFRESH_TOKEN_SECRET=dev-refresh-secret-32-chars-min

# API
API_PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001

# Frontend
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Storage
STORAGE_TYPE=local
BIN_UPLOAD_MAX_SIZE=52428800

# Logging
LOG_LEVEL=debug
```

---

## 🐛 Troubleshooting

### Node modules issues

```bash
# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Database issues

```bash
# Reset database
cd apps/api
npx prisma migrate reset

# Seed again
npx prisma db seed
```

### Build errors

```bash
# Clear Turborepo cache
pnpm clean
pnpm build

# Or with Turbo
pnpm turbo:clean
```

### Port already in use

```bash
# Kill process on port 3000
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Kill process on port 3001
lsof -i :3001 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### TypeScript errors

```bash
# Rebuild type definitions
pnpm type-check

# Regenerate Prisma client
cd apps/api && npx prisma generate
```

---

## 📚 Documentation

- **Architecture:** `docs/ARCHITECTURE.md` - Full repo architecture
- **API Docs:** `docs/API.md` - REST endpoints and examples
- **Database:** `docs/DATABASE.md` - Schema and migrations
- **Deployment:** `docs/DEPLOYMENT.md` - Deploy procedures
- **Contributing:** `docs/CONTRIBUTING.md` - Contribution guidelines

---

## 🚢 Deployment

### Staging (Automatic)

```bash
# Merge to develop branch
git merge feature/your-feature
git push origin develop

# Automatically deploys to:
# Web: https://caracal-staging.vercel.app
# API: https://api-staging.caracaltechmotors.com
```

### Production (Manual with Approval)

```bash
# Create release on main
git checkout main
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Triggers production deployment (requires approval)
```

---

## 🆘 Getting Help

- **Architecture Questions:** See `docs/ARCHITECTURE.md`
- **API Issues:** Check `docs/API.md`
- **Database Questions:** Read `docs/DATABASE.md`
- **Deployment Help:** View `docs/DEPLOYMENT.md`
- **GitHub Issues:** Search existing or create new issue
- **Slack:** #engineering channel

---

## ✅ First Day Checklist

- [ ] Repository cloned
- [ ] Dependencies installed (`pnpm install`)
- [ ] Environment variables configured (`.env.local`)
- [ ] Database running and migrated
- [ ] Dev servers started (`pnpm dev`)
- [ ] Able to access http://localhost:3000
- [ ] Git hooks installed (`npx husky install`)
- [ ] Created first feature branch
- [ ] Read `docs/ARCHITECTURE.md`
- [ ] Read `CONTRIBUTING.md`

---

## 💡 Pro Tips

1. **Keep dependencies updated:** `pnpm update`
2. **Use Prettier format on save:** Enable in your editor
3. **Use Turbo for faster builds:** `pnpm turbo:build`
4. **Check for breaking changes:** `pnpm audit`
5. **View Prisma schema visually:** `npx prisma studio`
6. **Enable verbose logging:** `NODE_ENV=development pnpm dev`
7. **Test before committing:** `pnpm test && pnpm lint`

---

**Questions?** Check the docs or open an issue on GitHub!
