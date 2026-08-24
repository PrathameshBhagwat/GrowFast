# AGENTS.md — Development Rules for Coding Agents

> **MANDATORY**: Read this file completely before modifying any code in this repository.

## Repository Overview

This is a **Laundry & Dry-Cleaning Management System** built as a monorepo with:

- **Backend**: NestJS + TypeScript + Prisma + PostgreSQL
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Shared**: TypeScript shared types, enums, DTOs, and `@growfast/ui` design system

## Architecture

```
apps/
  backend/     → NestJS REST API
  web/         → React PWA frontend

packages/
  shared-types/ → Shared enums, DTOs, contracts
  ui/           → Reusable design system components

prisma/        → Database schema and migrations
docs/          → Project documentation
```

---

## Development Rules

### General

1. **Read AGENTS.md** before modifying any code.
2. **Read relevant documentation** in `docs/` before implementing a feature.
3. **Do not modify unrelated modules.** Stay within your assigned ownership area.
4. **Do not change architecture** without explicit approval from the project lead.
5. **Do not introduce unnecessary dependencies.** Justify any new package.
6. **Never commit secrets.** No API keys, passwords, or tokens in source code.
7. **Use environment variables** for all secrets and configuration.
8. **Report all files changed** after completing a task.

### Backend

9. **Backend authorization must always be enforced server-side.** Use `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles()`.
10. **Frontend permissions are NOT security.** They are UX hints only.
11. **Business logic belongs in backend services.** Controllers handle HTTP; services handle logic.
12. **Financial calculations must have tests.** Any code involving money must be unit tested.
13. **Business-critical logic must have tests.** Status transitions, payment calculations, due-date logic.

### Shared Code

14. **Shared types must be reused.** Import from `@growfast/shared-types`, never redefine enums or duplicate types.
15. **Do not duplicate business logic.** If it exists in `shared-types` or a service, use it.
16. **Order status derivation uses `deriveOrderStatus()`** from `@growfast/shared-types`. Never manually compute or set order status.

### Database

17. **Database schema changes require explicit coordination.** Discuss before modifying `prisma/schema.prisma`.
18. **Never create competing Prisma migrations.** Only one developer modifies the schema at a time.
19. **Run `npx prisma generate`** after any schema change.

### Git & CI Workflow

20. **Never directly push to `main`.** Always use feature branches and pull requests.
21. **Never force-push to `main`.**
22. **Keep feature branches short-lived** (1–2 days max).
23. **Keep PRs small** (one logical feature per PR).
24. **Run lint, typecheck, build, and relevant tests** before creating a PR.
25. **CI must pass before merge.** A PR cannot be merged if CI fails.
26. **`main` must remain deployable** at all times.

---

## Developer Ownership Areas

### Developer A — Auth, Employee, Customer

**Backend Ownership:**

- `apps/backend/src/auth/`
- `apps/backend/src/employee/`
- `apps/backend/src/customer/`

**Frontend Ownership:**

- `apps/web/src/pages/LoginPage.tsx`
- `apps/web/src/pages/HomePage.tsx` / Customer Search
- `apps/web/src/pages/CustomerProfilePage.tsx`
- `apps/web/src/pages/CustomerDetailsPage.tsx`
- `apps/web/src/pages/StaffManagementPage.tsx`
- `apps/web/src/contexts/AuthContext.tsx`

### Developer B — Catalog, Order

**Backend Ownership:**

- `apps/backend/src/catalog/`
- `apps/backend/src/order/`

**Frontend Ownership:**

- `apps/web/src/pages/OrderWizardPage.tsx` (Order Creation Wizard)
- `apps/web/src/pages/OrderDetailPage.tsx`
- `apps/web/src/pages/MasterDataPage.tsx`
- `apps/web/src/pages/CatalogSettingsPage.tsx`

**Domain Logic Ownership:**

- Developer B owns the canonical order-status business logic and its rules.

### Developer C — Photo, Delivery, Payment, Notification, Dashboard

**Backend Ownership:**

- `apps/backend/src/photo/`
- `apps/backend/src/delivery/`
- `apps/backend/src/payment/`
- `apps/backend/src/notification/`
- `apps/backend/src/dashboard/`

**Frontend Ownership:**

- `apps/web/src/pages/DeliveryPage.tsx`
- `apps/web/src/pages/PhotoCaptureView.tsx`
- `apps/web/src/pages/DashboardPage.tsx`

**Domain Logic Rules:**

- Developer C must use canonical `deriveOrderStatus()` from `@growfast/shared-types` rather than reimplementing status logic.
- Developer C implements backend photo storage services while respecting the shared `@growfast/ui` `PhotoCapture` contract.

---

## Shared / High-Conflict Files

These files are modified by multiple developers and require **extra care and review**:

| File / Directory                   | Reason                                                   |
| ---------------------------------- | -------------------------------------------------------- |
| `prisma/schema.prisma`             | Database schema — coordinate with team before changes    |
| `prisma/migrations/`               | Prisma migration files — coordinate to prevent conflicts |
| `packages/shared-types/**`         | Shared enums and DTOs — impacts both apps                |
| `packages/ui/**`                   | Design system components — visual consistency            |
| `apps/backend/src/app.module.ts`   | Root backend module — adding new feature modules         |
| `apps/web/src/App.tsx` (or router) | Frontend routing configuration — adding new routes       |
| `package.json` (root)              | Workspace scripts and root dependencies                  |
| `tsconfig.json` (root/workspaces)  | TypeScript configuration                                 |
| `.github/workflows/**`             | CI/CD workflow definitions                               |
| `docs/**`                          | Architecture and project documentation                   |

### Shared Files Governance Rules

1. **Do not casually modify shared files.**
2. **Announce schema changes before implementation.**
3. **Never create competing Prisma migrations.**
4. **Shared type changes require review.**
5. **Shared UI changes require review.**
6. **Do not rewrite root configuration unnecessarily.**

---

## Quick Reference

```bash
# Start development
docker compose up -d               # Start PostgreSQL
npm run db:migrate                  # Run migrations
npm run db:seed                     # Seed development data
npm run dev:backend                 # Start backend (port 3000)
npm run dev:web                     # Start frontend (port 5173)

# Quality checks
npm run lint                        # Lint all workspaces
npm run typecheck                   # TypeScript check all
npm run test                        # Run all tests
npm run format                      # Format code
npm run format:check                # Check formatting

# Database
npm run db:generate                 # Regenerate Prisma client
npm run db:studio                   # Open Prisma Studio
```
