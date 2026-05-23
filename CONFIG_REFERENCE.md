# Configuration Files Reference

## Root Configuration Files

### turbo.json

```json
{
  "extends": ["//"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", ".turbo/cache/**"],
      "cache": true,
      "hashAlgorithm": "sha256"
    },
    "test": {
      "dependsOn": ["^build"],
      "cache": true,
      "inputs": ["src/**", "test/**", "jest.config.js"]
    },
    "lint": {
      "dependsOn": ["^build"],
      "cache": true,
      "inputs": ["src/**", ".eslintrc.js", "tsconfig.json"]
    },
    "type-check": {
      "dependsOn": ["^build"],
      "cache": true,
      "inputs": ["src/**", "tsconfig.json"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  },
  "globalDependencies": ["**/.env.*local", "turbo.json"],
  "globalEnv": ["NODE_ENV"]
}
```

### pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'

pnpm:
  peerDependencyRules:
    ignoreMissing:
      - 'eslint'
      - 'prettier'

# Shared scripts across all workspaces
scripts:
  dev: pnpm -r --parallel dev
  build: turbo build
  test: turbo test
  lint: turbo lint
  type-check: turbo type-check
  format: prettier --write "**/*.{ts,tsx,js,jsx,json,md}"
  format:check: prettier --check "**/*.{ts,tsx,js,jsx,json,md}"
```

### package.json (Root)

```json
{
  "name": "caracal-tech-motors",
  "version": "0.1.0",
  "private": true,
  "description": "Caracal Tech Motors Beta Platform - Monorepo",
  "license": "PROPRIETARY",
  "author": "Caracal Motors <dev@caracaltechmotors.com>",
  "repository": {
    "type": "git",
    "url": "https://github.com/caracal-motors/caracal-tech-motors.git"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  },
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "test:coverage": "turbo test -- --coverage",
    "test:smoke:staging": "pnpm --filter web test:smoke -- --config=playwright.staging.config.ts",
    "lint": "turbo lint",
    "lint:fix": "turbo lint -- --fix",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "type-check": "turbo type-check",
    "clean": "turbo clean && rm -rf node_modules",
    "db:migrate": "pnpm --filter api prisma migrate dev",
    "db:seed": "pnpm --filter api prisma db seed",
    "db:studio": "pnpm --filter api prisma studio",
    "precommit": "lint-staged",
    "prepare": "husky install"
  },
  "devDependencies": {
    "@commitlint/cli": "^17.8.0",
    "@commitlint/config-conventional": "^17.8.0",
    "@typescript-eslint/eslint-plugin": "^6.13.0",
    "@typescript-eslint/parser": "^6.13.0",
    "eslint": "^8.54.0",
    "eslint-config-prettier": "^9.0.0",
    "husky": "^8.0.3",
    "lint-staged": "^15.2.0",
    "prettier": "^3.1.0",
    "turbo": "^1.10.16",
    "typescript": "^5.3.2"
  },
  "pnpm": {
    "overrides": {
      "typescript": "^5.3.2"
    }
  }
}
```

### tsconfig.json (Root)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@caracal/types": ["./packages/@caracal/types/src"],
      "@caracal/utils": ["./packages/@caracal/utils/src"],
      "@caracal/db": ["./packages/@caracal/db/src"],
      "@caracal/config": ["./packages/@caracal/config/src"],
      "@caracal/auth": ["./packages/@caracal/auth/src"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["**/node_modules", "**/dist", "**/.next"]
}
```

### .eslintignore

```
node_modules
dist
.next
coverage
build
*.config.js
jest.config.js
vitest.config.ts
```

### .prettierrc.js

```javascript
module.exports = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  printWidth: 100,
  arrowParens: 'always',
  endOfLine: 'lf',
};
```

### .editorconfig

```ini
# EditorConfig helps maintain consistent coding styles
root = true

[*]
charset = utf-8
insert_final_newline = true
trim_trailing_whitespace = true
end_of_line = lf

[*.{js,jsx,ts,tsx}]
indent_style = space
indent_size = 2

[*.{json,yaml,yml}]
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
```

## App-Specific Configuration

### apps/api/package.json

```json
{
  "name": "@caracal/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --loader ts-node/esm src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest",
    "test:unit": "jest --testPathPattern='.*\\.test\\.ts$'",
    "test:integration": "jest --testPathPattern='.*\\.integration\\.ts$'",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write src",
    "type-check": "tsc --noEmit",
    "migrate:dev": "prisma migrate dev",
    "migrate:deploy": "prisma migrate deploy",
    "seed": "ts-node prisma/seeds/seed.ts"
  },
  "dependencies": {
    "@caracal/types": "workspace:*",
    "@caracal/utils": "workspace:*",
    "@caracal/db": "workspace:*",
    "@caracal/config": "workspace:*",
    "@caracal/auth": "workspace:*",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "dotenv": "^16.3.1",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/express": "^4.17.20",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.2",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.1"
  }
}
```

### apps/web/package.json

```json
{
  "name": "@caracal/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write .",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "test:unit": "jest --testPathPattern='.*\\.test\\.tsx?$'",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:smoke:staging": "playwright test -c playwright.staging.config.ts"
  },
  "dependencies": {
    "@caracal/types": "workspace:*",
    "@caracal/utils": "workspace:*",
    "@caracal/config": "workspace:*",
    "@caracal/auth": "workspace:*",
    "next": "^15.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tailwindcss": "^3.3.6"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.42",
    "@types/react-dom": "^18.2.17",
    "typescript": "^5.3.2",
    "jest": "^29.7.0",
    "@testing-library/react": "^14.1.2",
    "@playwright/test": "^1.40.1"
  }
}
```

### packages/@caracal/types/package.json

```json
{
  "name": "@caracal/types",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.3.2"
  }
}
```

## CI/CD Configuration

### .github/workflows/ci.yml

See: `github-actions-ci.yml` (already provided above)

### .github/workflows/cd.yml

See: `github-actions-cd.yml` (already provided above)

### .github/CODEOWNERS

```
# Default owners for everything
* @caracal-core-team @caracal-backend-team

# API changes
apps/api/ @caracal-backend-team @caracal-core-team
apps/api/migrations/ @caracal-dba-team @caracal-core-team

# Frontend
apps/web/ @caracal-frontend-team @caracal-core-team

# Database
packages/@caracal/db/ @caracal-dba-team @caracal-core-team

# Security/Auth
packages/@caracal/auth/ @caracal-security-team @caracal-core-team
.github/workflows/ @caracal-security-team @caracal-core-team

# Shared types
packages/@caracal/types/ @caracal-core-team
```

## Environment Variables

### .env.example

See `ARCHITECTURE.md` Section 4 for complete `.env.example`

### .env.local (Git Ignored)

Create from `.env.example` with local values:
```
DATABASE_URL=postgresql://user:password@localhost:5432/caracal_dev
JWT_SECRET=your-dev-secret-min-32-chars
API_PORT=3001
...
```

## Docker Configuration

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: caracal
      POSTGRES_PASSWORD: caracal_dev
      POSTGRES_DB: caracal_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U caracal"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
    driver: local
```

---

## Summary: Files to Create/Configure

**On Day 1, create/configure:**

1. ✅ `turbo.json` - Monorepo orchestration
2. ✅ `pnpm-workspace.yaml` - Workspace definition
3. ✅ `tsconfig.json` - Root TypeScript config
4. ✅ `.eslintrc.js` - Linting rules
5. ✅ `.prettierrc.js` - Code formatting
6. ✅ `.editorconfig` - Editor defaults
7. ✅ `.env.example` - Environment template
8. ✅ `docker-compose.yml` - Local services
9. ✅ `.github/workflows/ci.yml` - CI pipeline
10. ✅ `.github/workflows/cd.yml` - CD pipeline
11. ✅ `.github/CODEOWNERS` - Code ownership
12. ✅ Package-specific configs in each app/package

All provided in this guide!
