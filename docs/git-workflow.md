# Team Git Workflow

## Overview

This document defines the Git branching, committing, pull request, and merge standards for all developers working on GrowFast.

```
main (protected, always deployable)
  │
  ├── feature/customer-search  (Developer A)
  ├── feature/order-create     (Developer B)
  └── feature/delivery-tasks   (Developer C)
```

---

## 1. Branching Model

### The Golden Rules

1. **Never commit directly to `main`.**
2. **Never force-push to `main`.**
3. **`main` must always be deployable and pass CI.**
4. **Keep feature branches short-lived** (1–2 days maximum).
5. **Keep PRs small** (one logical feature/fix per PR).
6. **Pull `main` frequently** into your feature branch to stay up to date.

### Branch Naming Conventions

- `feature/<module>-<action>` (e.g., `feature/customer-search`, `feature/order-create`, `feature/photo-upload`)
- `fix/<issue-description>` (e.g., `fix/payment-calculation`, `fix/customer-search-validation`)
- `chore/<maintenance-task>` (e.g., `chore/database-schema-add-tags`, `chore/ci-caching`)

---

## 2. Standard Feature Lifecycle

### Step 1: Start from clean `main`

```bash
git checkout main
git pull origin main
```

### Step 2: Create feature branch

```bash
git checkout -b feature/<feature-name>
```

### Step 3: Implement & Test

Develop your feature within your assigned ownership area. Run tests locally:

```bash
npm run typecheck
npm run test
npm run lint
npm run format:check
```

### Step 4: Commit your changes

Write clear, conventional commit messages:

```bash
git add .
git commit -m "feat(customer): implement phone-based search endpoint"
```

### Step 5: Push and Open PR

```bash
git push -u origin feature/<feature-name>
```

Open a Pull Request on GitHub targeting `main`. Fill in the PR template completely.

### Step 6: CI & Code Review

- Ensure the GitHub Actions CI workflow passes completely.
- Address any code review feedback from teammates.
- Make additional commits if needed.

### Step 7: Merge & Cleanup

- Use **Squash and Merge** or standard Merge commit as configured by team lead.
- Delete the remote feature branch.
- Switch back to `main` locally:

```bash
git checkout main
git pull origin main
git branch -d feature/<feature-name>
```

---

## 3. Pull Request Standards

Every Pull Request must:

1. Include a filled-out PR template.
2. Indicate which developer ownership area it belongs to.
3. Pass all automated CI checks (typecheck, tests, builds, lint).
4. Contain unit tests for any financial or critical business logic.
5. Not modify code owned by another developer without explicit approval.
