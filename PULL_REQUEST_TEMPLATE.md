## 🎯 Description

Brief explanation of the changes and why they're needed. What problem does this solve?

**Related Issues:**
- Closes #123
- Related to #456

---

## 📝 Type of Change

- [ ] 🐛 Bug fix (non-breaking change fixing an issue)
- [ ] ✨ New feature (non-breaking change adding functionality)
- [ ] 🔄 Refactor (code improvement without behavior change)
- [ ] 🚀 Performance improvement
- [ ] 📚 Documentation update
- [ ] 🔒 Security enhancement
- [ ] ⚠️ Breaking change (fix or feature that would cause existing functionality to change)

---

## ✅ Changes Made

- Change 1: Brief description
- Change 2: Brief description
- Change 3: Brief description

---

## 🧪 Testing

**How was this tested?**

- [ ] Added/updated unit tests
- [ ] Added/updated integration tests
- [ ] Manual testing completed
- [ ] E2E tests updated
- [ ] Tested locally with `pnpm dev`

**Testing Steps:**

1. Start dev environment: `pnpm dev`
2. Navigate to: [URL or page]
3. Perform action: [Step description]
4. Expected result: [What should happen]

**Test Coverage:**
- Unit tests: XX% coverage
- Integration tests: Passing
- E2E tests: Passing

---

## 📸 Screenshots / Recordings

*If applicable, add before/after screenshots or screen recordings*

---

## 📋 Checklist

- [ ] Code follows project style guidelines (ESLint passes)
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated (ARCHITECTURE.md, API.md, etc)
- [ ] No new warnings generated
- [ ] All tests pass locally (`pnpm test`)
- [ ] Build succeeds locally (`pnpm build`)
- [ ] No merge conflicts
- [ ] Commit messages follow convention (feat(scope): message)
- [ ] Branch name follows convention (feature/*, bugfix/*, hotfix/*)

---

## 🔍 Code Review Checklist (for Reviewers)

- [ ] Code logic is correct and efficient
- [ ] No security vulnerabilities introduced
- [ ] No breaking changes without proper deprecation
- [ ] Database migrations are safe and reversible
- [ ] Environment variables documented
- [ ] Tests adequately cover changes
- [ ] No hardcoded secrets or sensitive data
- [ ] Proper error handling and logging
- [ ] TypeScript types are properly defined

---

## 📦 Affected Packages/Apps

- [ ] `apps/web` (Frontend)
- [ ] `apps/api` (Backend)
- [ ] `apps/workshop-portal`
- [ ] `apps/consulting-dashboard`
- [ ] `packages/@caracal/types`
- [ ] `packages/@caracal/utils`
- [ ] `packages/@caracal/db`
- [ ] `packages/@caracal/auth`
- [ ] `packages/@caracal/config`

---

## 🚨 Breaking Changes

Does this PR introduce breaking changes?

- [ ] No breaking changes
- [ ] Yes, breaking changes (explain below)

**If yes, explain:**
- What breaks?
- Migration path for users?
- Deprecation period?

---

## 📖 Additional Context

Any additional information that reviewers should know?

- Performance impact: [describe if any]
- Database schema changes: [list any migrations]
- Configuration changes: [list any new env vars]
- Dependencies added: [list if any]

---

## 🔗 Links

- Design doc: [link if applicable]
- Figma mockup: [link if applicable]
- Related PRs: [link if applicable]

---

## 🎬 Deployment Notes

**For reviewers/devops:**
- Does this need a migration? Yes/No
- Does this need config changes? Yes/No
- Can this be rolled back if needed? Yes/No
- Should this be deployed with other PRs? Yes/No (explain)

---

**Ready for review?** ✅

- Tick the checkbox once this PR is ready for review and all the above items are completed.

- [ ] This PR is ready for review
