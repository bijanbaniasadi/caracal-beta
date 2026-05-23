# GitHub Issue Templates

## 1. BUG_REPORT.md

```markdown
---
name: Bug Report
about: Report a bug to help us improve
title: "[BUG] "
labels: ["🐛 bug", "⏳ ready"]
assignees: ""
---

## 🐛 Describe the Bug

Clear, concise description of what the bug is.

## 🔄 Steps to Reproduce

Steps to reproduce the behavior:

1. Navigate to '...'
2. Click on '....'
3. See error

## ✅ Expected Behavior

What should happen instead?

## ❌ Actual Behavior

What actually happens?

## 📸 Screenshots

If applicable, add screenshots showing the problem.

## 🖥️ Environment

- **Browser:** Chrome/Firefox/Safari/Edge
- **OS:** Windows/Mac/Linux
- **App Version:** [e.g., v1.0.0]
- **Node version:** [if applicable]

## 📋 Additional Context

Any other context that might help?

## 🏷️ Labels

- Area: `api` | `web` | `workshop` | `toolstore` | `consulting` | `db`
- Priority: `🔴 critical` | `🟠 high` | `🟡 medium` | `🟢 low`
- Status: `📌 backlog` | `⏳ ready`

---

**Checklist:**
- [ ] I have searched existing issues for duplicates
- [ ] I have provided clear reproduction steps
- [ ] Screenshots/logs are included if applicable
- [ ] This is not a usage question
```

## 2. FEATURE_REQUEST.md

```markdown
---
name: Feature Request
about: Suggest an idea for improvement
title: "[FEATURE] "
labels: ["✨ feature", "📌 backlog"]
assignees: ""
---

## 🎯 Problem Statement

Is your feature request related to a problem? Describe it.

Example: "I'm trying to [use case] but..."

## 💡 Proposed Solution

Clear description of what you want to happen.

## 🤔 Alternative Solutions

Any alternative approaches you've considered?

## 📊 Use Case

Who needs this? What's the business value?

- User type: [Workshop manager | Tool developer | Consultant]
- Frequency: [How often would this be used?]
- Impact: [High | Medium | Low]

## 📋 Acceptance Criteria

How do we know this is done?

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## 🏷️ Labels

- Area: `api` | `web` | `workshop` | `toolstore` | `consulting`
- Priority: `🔴 critical` | `🟠 high` | `🟡 medium` | `🟢 low`
- Status: `📌 backlog`

---

**Checklist:**
- [ ] I have searched for duplicate feature requests
- [ ] I have described the problem and solution clearly
- [ ] I have provided use cases
- [ ] Acceptance criteria are defined
```

## 3. TASK.md

```markdown
---
name: Task
about: Work item or technical task
title: "[TASK] "
labels: ["🔄 chore", "📌 backlog"]
assignees: ""
---

## 📝 Description

What needs to be done?

## 🎯 Objective

What are we trying to achieve?

## 📋 Subtasks

- [ ] Subtask 1
- [ ] Subtask 2
- [ ] Subtask 3

## 🔗 Related Issues

- Relates to #123
- Depends on #456
- Blocks #789

## 📋 Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## 📚 Resources

- Design doc: [link]
- Reference: [link]
- Architecture: [link]

## 🏷️ Labels

- Area: `api` | `web` | `workshop` | `toolstore` | `db` | `devops`
- Priority: `🔴 critical` | `🟠 high` | `🟡 medium` | `🟢 low`
- Status: `📌 backlog` | `⏳ ready` | `🚀 in-progress`

---

**Checklist:**
- [ ] Task is well-defined
- [ ] Success criteria are clear
- [ ] Dependencies are documented
```

---

## Usage Instructions

### Creating an Issue

1. Click "New Issue" on the GitHub repo
2. Choose a template (Bug, Feature, Task)
3. Fill out all sections
4. Add appropriate labels
5. Assign to yourself (if claiming) or leave unassigned
6. Submit

### Issue Labeling Guidelines

**Always add:**
- ONE type label: `🐛 bug` | `✨ feature` | `🔄 chore` | etc.
- ONE priority label: `🔴 critical` | `🟠 high` | `🟡 medium` | `🟢 low`
- ONE area label: `api` | `web` | `workshop` | `toolstore` | `db` | `consulting`

**For bugs:**
- Add: `🐛 bug` + priority + area
- Example: `🐛 bug`, `🟠 high`, `api`

**For features:**
- Add: `✨ feature` + priority + area
- Example: `✨ feature`, `🟡 medium`, `toolstore`

**For tasks:**
- Add: `🔄 chore` + area
- Example: `🔄 chore`, `db`

### Label Reference

```
TYPE LABELS:
🐛 bug               - Bug report
✨ feature           - Feature request
🔄 refactor          - Code refactoring
🩹 chore             - Maintenance/chore
📚 documentation     - Docs update
🔒 security          - Security issue
♻️ dependencies      - Dependency update

PRIORITY LABELS:
🔴 critical          - Production down, urgent
🟠 high              - Major feature/bug
🟡 medium            - Normal priority
🟢 low               - Nice to have

STATUS LABELS:
📌 backlog           - Not yet scheduled
⏳ ready             - Ready to start
🚀 in-progress       - Someone working
🔍 review            - In code review
🎉 done              - Completed

AREA LABELS:
api                  - Backend API
web                  - Frontend/Next.js
workshop             - Workshop portal
toolstore            - Tool store feature
consulting           - Consulting system
db                   - Database
devops               - Deployment/CI-CD
auth                 - Authentication
```

---

## Examples

### Example: Bug Report

**Title:** `[BUG] Workshop account creation fails with email validation error`

**Labels:** `🐛 bug`, `🟠 high`, `workshop`

**Body:**
```
## Describe the Bug
Workshop managers cannot create new accounts when using email addresses with plus signs (+).

## Steps to Reproduce
1. Go to /workshop/accounts
2. Click "Create Account"
3. Enter email: "user+tag@example.com"
4. Submit form
5. See error: "Invalid email format"

## Expected Behavior
Email with + signs should be accepted and account created.

## Actual Behavior
Form shows validation error and account is not created.

## Environment
- Browser: Chrome 120
- OS: macOS 14.2
- App Version: v1.0.0-beta.5
```

### Example: Feature Request

**Title:** `[FEATURE] Support .hex and .elf file upload alongside .bin`

**Labels:** `✨ feature`, `🟡 medium`, `toolstore`

**Body:**
```
## Problem Statement
Users often work with .hex and .elf files but can only upload .bin files currently.

## Proposed Solution
Extend BIN upload to accept .hex and .elf formats with appropriate parsing.

## Use Case
- User type: Tool developers
- Frequency: Weekly
- Impact: High - Blocks tool creation workflow for some users

## Acceptance Criteria
- [ ] Upload accepts .hex, .elf, .bin files
- [ ] Files are parsed correctly
- [ ] Tests cover all three formats
- [ ] Documentation updated
```

### Example: Task

**Title:** `[TASK] Upgrade TypeScript to 5.3.0 across monorepo`

**Labels:** `🔄 chore`, `♻️ dependencies`, `api`

**Body:**
```
## Description
Update TypeScript version to v5.3.0 and resolve any breaking changes.

## Objective
Stay current with TypeScript releases and benefit from new features/fixes.

## Subtasks
- [ ] Update package.json
- [ ] Run type checks and fix errors
- [ ] Update docs
- [ ] Test in CI/CD

## Acceptance Criteria
- [ ] All packages use TS 5.3.0
- [ ] Type checking passes
- [ ] CI builds successfully
- [ ] No regressions in tests
```
