# Contributing

Thanks for contributing to Caracal Tech Motors. This guide keeps changes easy to review and safe to ship.

## Getting Started

1. Install Node.js 20.x, pnpm 8.x, Docker, PostgreSQL, and Git.
2. Install dependencies:

```bash
pnpm install
```

3. Copy environment variables and configure local values:

```bash
cp .env.example .env.local
```

4. Start the development environment:

```bash
pnpm dev
```

Frontend runs on `http://localhost:3000`; API runs on `http://localhost:3001`.

## Git Workflow

Start from an updated `develop` branch:

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

Use these branch prefixes:

- `feature/*`
- `bugfix/*`
- `hotfix/*`
- `chore/*`
- `docs/*`

## Commit Messages

Use this format:

```text
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`, `style`.

Scopes: `api`, `web`, `workshop`, `consulting`, `db`, `auth`, `toolstore`, `bin-upload`, `config`, `ci`, `deps`.

Examples:

```text
feat(toolstore): add BIN file validation
fix(api): resolve workshop account creation timeout
test(db): add migration tests for user schema
```

## Issues

Use the GitHub issue templates for bug reports, feature requests, and tasks. Add one type label, one priority label, and one area label where possible. See `.github/LABELS.md` for the full label reference.

## Pull Requests

Open pull requests against `develop` unless the change is an approved hotfix. Fill out the pull request template completely, link related issues, include screenshots for UI changes, and list any migration, configuration, or deployment impact.

Before requesting review:

- [ ] Run the relevant tests
- [ ] Run linting and type checks
- [ ] Update documentation if behavior changed
- [ ] Confirm no secrets or sensitive data are included
- [ ] Confirm the branch and commit names follow convention

## Testing

Run the full test suite:

```bash
pnpm test
```

Run common checks before merge:

```bash
pnpm lint
pnpm type-check
pnpm build
```

Run workspace-specific tests with pnpm filters:

```bash
pnpm --filter web test
pnpm --filter api test
pnpm --filter @caracal/utils test
```

## Security

Do not open public issues for vulnerabilities or suspected secrets. Follow `SECURITY.md` for private reporting.
