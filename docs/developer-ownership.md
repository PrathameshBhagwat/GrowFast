# Developer Ownership & Module Boundaries

## Overview

To enable 3 developers to work safely in parallel without collisions, the codebase is strictly divided into distinct ownership domains.

---

## 1. Developer Assignments

### Developer A — Auth, Employee, Customer

- **Backend Ownership:**
  - `apps/backend/src/auth/`
  - `apps/backend/src/employee/`
  - `apps/backend/src/customer/`
- **Frontend Ownership:**
  - `apps/web/src/pages/LoginPage.tsx`
  - `apps/web/src/pages/HomePage.tsx` / Customer Search
  - `apps/web/src/pages/CustomerProfilePage.tsx`
  - `apps/web/src/pages/CustomerDetailsPage.tsx`
  - `apps/web/src/pages/StaffManagementPage.tsx`
  - `apps/web/src/contexts/AuthContext.tsx`
- **Core Responsibilities:**
  - Authentication (PIN login, JWT validation, role-based access control)
  - Staff management (Employee CRUD, roles)
  - Customer management (Customer search by phone/name, creation, profile, order history lookup)

---

### Developer B — Catalog, Order

- **Backend Ownership:**
  - `apps/backend/src/catalog/`
  - `apps/backend/src/order/`
- **Frontend Ownership:**
  - `apps/web/src/pages/OrderWizardPage.tsx` (Order Creation Wizard)
  - `apps/web/src/pages/OrderDetailPage.tsx`
  - `apps/web/src/pages/MasterDataPage.tsx`
  - `apps/web/src/pages/CatalogSettingsPage.tsx`
- **Core Responsibilities:**
  - Garment catalog & service types
  - Order creation and multi-step intake flow
  - Due-date calculation and express surcharge calculation
  - Order items and pricing calculations
  - **Single Source of Truth:** Developer B owns and maintains canonical order-status business logic (`deriveOrderStatus`).

---

### Developer C — Photo, Delivery, Payment, Notification, Dashboard

- **Backend Ownership:**
  - `apps/backend/src/photo/`
  - `apps/backend/src/delivery/`
  - `apps/backend/src/payment/`
  - `apps/backend/src/notification/`
  - `apps/backend/src/dashboard/`
- **Frontend Ownership:**
  - `apps/web/src/pages/DeliveryPage.tsx`
  - `apps/web/src/pages/PhotoCaptureView.tsx`
  - `apps/web/src/pages/DashboardPage.tsx`
- **Core Responsibilities:**
  - Photo upload storage service (S3/cloud/local)
  - Payment processing & collection records (Cash, UPI, Card)
  - Delivery dispatch, driver task assignment, and proof-of-delivery photos
  - Partial delivery item reconciliation
  - Manager & Owner KPI dashboards
  - Notification hooks (SMS/WhatsApp foundation)
- **Rules:**
  - Developer C MUST use `deriveOrderStatus()` from `@growfast/shared-types` instead of re-implementing status logic.
  - Developer C implements backend storage behind the shared `@growfast/ui` `PhotoCapture` contract.

---

## 2. Shared Files Governance

The following files are touched across domains and require coordination:

| File / Directory                 | Purpose              | Coordination Rule                                                      |
| -------------------------------- | -------------------- | ---------------------------------------------------------------------- |
| `prisma/schema.prisma`           | Database schema      | Post an issue using `database_change.md` before editing                |
| `prisma/migrations/`             | Migration files      | Only one developer migrates schema at a time                           |
| `packages/shared-types/**`       | Common enums & DTOs  | Non-breaking additions allowed; breaking changes require team approval |
| `packages/ui/**`                 | Shared design system | Reusable components; do not duplicate                                  |
| `apps/backend/src/app.module.ts` | Root module          | Register feature modules in designated sections                        |
| `apps/web/src/App.tsx`           | App router           | Register feature routes cleanly                                        |
| `package.json` (root)            | Workspace config     | Lead engineer approval for new dependencies                            |
| `.github/workflows/**`           | CI definitions       | Protected; lead engineer review                                        |

---

## 3. Phase 1 Integration Seams

### Seam 1 — Customer → Order

- **Interaction:** Customer Details / Search page (Developer A) provides an action to "Create Order".
- **Integration Contract:** Navigates or passes `customerId` to the Order Wizard (Developer B) at `/orders/new?customerId=:id` or via state.

### Seam 2 — Order → Photo

- **Interaction:** Order intake wizard (Developer B) captures garment photos (intake/stains/defects).
- **Integration Contract:** Order Wizard uses the shared `PhotoCapture` component from `@growfast/ui`. The files are uploaded through Developer C's photo service endpoint `POST /api/photos/upload`.

### Seam 3 — Delivery → Order Status

- **Interaction:** Delivery module (Developer C) marks individual items as delivered (`deliveredQuantity`).
- **Integration Contract:** Delivery status updates trigger `deriveOrderStatus()` from `@growfast/shared-types` to automatically compute the updated order status. Developer C must never manually override status calculation.

### Seam 4 — Payment → Order

- **Interaction:** Recording payments (Developer C) updates payment balance.
- **Integration Contract:** Payment service updates `amountPaid`, `amountDue`, and `paymentStatus` on the Order record. Payment calculation logic remains decoupled from delivery status.

---

## 4. Database Schema Change Process

1. **Create Issue:** Developer opens a GitHub issue using the `database_change.md` template.
2. **Review:** Team reviews the proposed change to avoid collisions.
3. **Branch:** The developer creates a branch `chore/schema-<change-description>`.
4. **Edit & Migrate:**
   ```bash
   # Edit prisma/schema.prisma
   npx prisma migrate dev --name <change_name> --schema=prisma/schema.prisma
   npx prisma generate --schema=prisma/schema.prisma
   ```
5. **Update Shared Types:** Update `packages/shared-types/src/` to match.
6. **PR & Merge:** Fast-tracked PR merged to `main`.
7. **Sync:** All developers run `git checkout main && git pull && npm run db:generate`.
