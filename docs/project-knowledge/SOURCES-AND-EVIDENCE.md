# SOURCES-AND-EVIDENCE — Project Knowledge Audit Trail

## 1. Audit Methodology & Verification Principles

This document serves as the auditable index for the entire GrowFast technical documentation suite (`docs/project-knowledge/`). Every architectural claim, business formula, security mechanism, and technical challenge documented in this repository is mapped directly to concrete source code files, database models, configuration manifests, test suites, or Git commit logs.

### Evidence Classification Legend

- **[VERIFIED-CODE]**: Directly inspected in active source files and configuration manifests.
- **[VERIFIED-TEST]**: Confirmed by executing automated unit/integration test suites.
- **[VERIFIED-HARDWARE]**: Physically observed running on local development hardware (e.g. physical Android phone over LAN).
- **[INFERRED-GIT]**: Reconstructed from authentic Git commit logs and commit diffs.
- **[LIMITATION-GAP]**: Identified as an unverified dependency, missing hardware driver, or future roadmap item.

---

## 2. Evidence Index by Architectural Domain

### 2.1 Monorepo Structure & Dependency Manifests

- **Root npm Workspaces**: [package.json](file:///c:/Users/dell/Desktop/Infystent/GrowFast/package.json) `workspaces: ["packages/*", "apps/*"]` **[VERIFIED-CODE]**
- **Backend Dependencies**: [apps/backend/package.json](file:///c:/Users/dell/Desktop/Infystent/GrowFast/apps/backend/package.json) (NestJS 10.4.0, Prisma 5.20.0, bcryptjs 2.4.3, passport-jwt 4.0.1, @whiskeysockets/baileys 6.6.0, pdfkit 0.15.0) **[VERIFIED-CODE]**
- **Web Dependencies**: [apps/web/package.json](file:///c:/Users/dell/Desktop/Infystent/GrowFast/apps/web/package.json) (React 19.2.8, Vite 6.0.0, Tailwind CSS 4.0.0, react-router-dom 7.1.0, lucide-react 1.16.0) **[VERIFIED-CODE]**
- **Mobile Dependencies**: [apps/mobile/package.json](file:///c:/Users/dell/Desktop/Infystent/GrowFast/apps/mobile/package.json) (React 18.3.1, React Native 0.76.9, Expo SDK 52.0.49, expo-router ~4.0.0, expo-sqlite ~15.1.4, expo-secure-store ~14.0.0, @tanstack/react-query 5.66.0) **[VERIFIED-CODE]**
- **Shared Types**: [packages/shared-types/package.json](file:///c:/Users/dell/Desktop/Infystent/GrowFast/packages/shared-types/package.json) (Pure TypeScript, zero runtime dependencies) **[VERIFIED-CODE]**
- **Shared UI**: [packages/ui/package.json](file:///c:/Users/dell/Desktop/Infystent/GrowFast/packages/ui/package.json) (React 19 Web design system components) **[VERIFIED-CODE]**

---

### 2.2 Database & Data Model

- **Prisma Schema**: [prisma/schema.prisma](file:///c:/Users/dell/Desktop/Infystent/GrowFast/prisma/schema.prisma) (16 models: `Store`, `Employee`, `Customer`, `GarmentCatalog`, `ServiceType`, `ServiceGarmentPrice`, `Order`, `OrderItem`, `PhysicalGarment`, `OrderPhoto`, `Payment`, `FinancialAdjustment`, `DeliveryRecord`, `Notification`, `TagTemplate`, `BusinessSequence`) **[VERIFIED-CODE]**
- **Composite Unique Constraints**:
  - `Order`: `@@unique([storeId, clientDraftId])` ([schema.prisma:L236](file:///c:/Users/dell/Desktop/Infystent/GrowFast/prisma/schema.prisma#L236)) **[VERIFIED-CODE]**
  - `PhysicalGarment`: `@@unique([orderItemId, unitNumber])` ([schema.prisma:L341](file:///c:/Users/dell/Desktop/Infystent/GrowFast/prisma/schema.prisma#L341)) **[VERIFIED-CODE]**
  - `PhysicalGarment Tag`: `@unique tagId` ([schema.prisma:L330](file:///c:/Users/dell/Desktop/Infystent/GrowFast/prisma/schema.prisma#L330)) **[VERIFIED-CODE]**
  - `ServiceGarmentPrice`: `@@unique([garmentCatalogId, serviceTypeId, storeId])` ([schema.prisma:L183](file:///c:/Users/dell/Desktop/Infystent/GrowFast/prisma/schema.prisma#L183)) **[VERIFIED-CODE]**
- **Mobile SQLite Migration Engine**: [apps/mobile/src/db/sqlite.ts](file:///c:/Users/dell/Desktop/Infystent/GrowFast/apps/mobile/src/db/sqlite.ts) (`schema_migrations`, `order_drafts`, `pending_photos`) **[VERIFIED-CODE]**

---

### 2.3 Shared Business Contracts & Pricing Logic

- **Canonical Order Status Machine**: [packages/shared-types/src/order-status.ts](file:///c:/Users/dell/Desktop/Infystent/GrowFast/packages/shared-types/src/order-status.ts) (`deriveOrderStatus()`, lowest-index precedence) **[VERIFIED-CODE]**
- **Financial Pricing Formula**: [packages/shared-types/src/pricing.ts](file:///c:/Users/dell/Desktop/Infystent/GrowFast/packages/shared-types/src/pricing.ts) (`calculateOrderTotals()`, 18% GST rate, `roundCurrency()`) **[VERIFIED-CODE]**
- **Express Delivery Multipliers**: [packages/shared-types/src/pricing.ts:L29-L50](file:///c:/Users/dell/Desktop/Infystent/GrowFast/packages/shared-types/src/pricing.ts#L29-L50) (`getExpressMultiplier`: Same-Day = 2.0x, Next-Day Evening = 1.5x, Regular = 0x) **[VERIFIED-CODE]**
- **Partial Pickup Breakdown**: [packages/shared-types/src/pricing.ts:L133-L177](file:///c:/Users/dell/Desktop/Infystent/GrowFast/packages/shared-types/src/pricing.ts#L133-L177) (`calculateFulfillmentBreakdown()`) **[VERIFIED-CODE]**
- **Catalog & Service Rules**: [packages/shared-types/src/catalog.ts](file:///c:/Users/dell/Desktop/Infystent/GrowFast/packages/shared-types/src/catalog.ts) (Dry Cleaning per-piece, Laundry minimum 2.00 kg, Starching restricted to Men/Women/Kids, Shoe hidden services) **[VERIFIED-CODE]**
- **Thursday Weekly Off Due Date Rollover**: [packages/shared-types/src/catalog.ts:L574-L586](file:///c:/Users/dell/Desktop/Infystent/GrowFast/packages/shared-types/src/catalog.ts#L574-L586) (`adjustDueDateForThursday()`) **[VERIFIED-CODE]**
- **Statutory Bill Notices**: [packages/shared-types/src/catalog.ts:L529-L539](file:///c:/Users/dell/Desktop/Infystent/GrowFast/packages/shared-types/src/catalog.ts#L529-L539) (`GARMENT_COLLECTION_NOTICE`, `STAIN_REMOVAL_NOTICE`) **[VERIFIED-CODE]**

---

### 2.4 Mobile Offline Staging & Synchronization

- **Sync Engine Implementation**: [apps/mobile/src/services/sync-engine.ts](file:///c:/Users/dell/Desktop/Infystent/GrowFast/apps/mobile/src/services/sync-engine.ts) (`SyncEngine`) **[VERIFIED-CODE]**
- **Mutex Concurrency Locks**: [sync-engine.ts:L68-L72](file:///c:/Users/dell/Desktop/Infystent/GrowFast/apps/mobile/src/services/sync-engine.ts#L68-L72) (`activeLocks.has(clientDraftId)`) **[VERIFIED-CODE]**
- **Two-Phase Idempotency Probe**: [sync-engine.ts:L104-L120](file:///c:/Users/dell/Desktop/Infystent/GrowFast/apps/mobile/src/services/sync-engine.ts#L104-L120) (Pre-check) and [sync-engine.ts:L151-L160](file:///c:/Users/dell/Desktop/Infystent/GrowFast/apps/mobile/src/services/sync-engine.ts#L151-L160) (Post-timeout probe to `GET /orders/by-draft/:draftId`) **[VERIFIED-CODE]**
- **Bounded Exponential Backoff with Jitter**: [sync-engine.ts:L43-L48](file:///c:/Users/dell/Desktop/Infystent/GrowFast/apps/mobile/src/services/sync-engine.ts#L43-L48) (`calculateBackoff`) **[VERIFIED-CODE]**
- **Local Photo File Verification**: [sync-engine.ts:L259-L266](file:///c:/Users/dell/Desktop/Infystent/GrowFast/apps/mobile/src/services/sync-engine.ts#L259-L266) (`checkFileExists`) **[VERIFIED-CODE]**
- **Hardware Token Storage**: [apps/mobile/src/storage/secure-store.ts](file:///c:/Users/dell/Desktop/Infystent/GrowFast/apps/mobile/src/storage/secure-store.ts) (`expo-secure-store`) **[VERIFIED-CODE]**

---

### 2.5 Security & Backend Authorization

- **PIN Verification**: [apps/backend/src/auth/auth.service.ts:L41](file:///c:/Users/dell/Desktop/Infystent/GrowFast/apps/backend/src/auth/auth.service.ts#L41) (`bcrypt.compare(pin, employee.pinHash)`) **[VERIFIED-CODE]**
- **JWT Signing & Payload**: [auth.service.ts:L47-L54](file:///c:/Users/dell/Desktop/Infystent/GrowFast/apps/backend/src/auth/auth.service.ts#L47-L54) (`{ sub, role, storeId, name }`) **[VERIFIED-CODE]**
- **Rate Limiting**: [apps/backend/src/auth/auth.controller.ts:L28](file:///c:/Users/dell/Desktop/Infystent/GrowFast/apps/backend/src/auth/auth.controller.ts#L28) (`@Throttle({ limit: 5 in prod / 100 in dev })`) **[VERIFIED-CODE]**
- **Role Guards**: [apps/backend/src/auth/roles.guard.ts](file:///c:/Users/dell/Desktop/Infystent/GrowFast/apps/backend/src/auth/roles.guard.ts) & `@Roles('OWNER', 'MANAGER')` **[VERIFIED-CODE]**
- **Payment Idempotency**: [apps/backend/src/payment/payment.service.ts](file:///c:/Users/dell/Desktop/Infystent/GrowFast/apps/backend/src/payment/payment.service.ts) & `@unique idempotencyKey` **[VERIFIED-CODE]**

---

### 2.6 Testing & Verification Evidence

- **Backend Test Suite (300+ tests)**:
  - `apps/backend/src/order/order-idempotency.spec.ts` **[VERIFIED-TEST]**
  - `apps/backend/src/order/tag-system.spec.ts` **[VERIFIED-TEST]**
  - `apps/backend/src/payment/payment-idempotency.spec.ts` **[VERIFIED-TEST]**
  - `apps/backend/src/auth/auth.service.spec.ts` **[VERIFIED-TEST]**
- **Mobile Test Suite (65 tests)**:
  - `apps/mobile/src/__tests__/mobile-auth.test.ts` **[VERIFIED-TEST]**
  - `apps/mobile/src/__tests__/order-wizard.test.ts` **[VERIFIED-TEST]**
  - `apps/mobile/src/__tests__/payment-workflow.test.ts` **[VERIFIED-TEST]**
  - `apps/mobile/src/__tests__/draft-sync.test.ts` **[VERIFIED-TEST]**
  - `apps/mobile/src/__tests__/live-backend-e2e.test.ts` **[VERIFIED-TEST]**
- **Shared Types Test Suite (115 tests)**:
  - `packages/shared-types/src/pricing.spec.ts` **[VERIFIED-TEST]**
  - `packages/shared-types/src/catalog.spec.ts` **[VERIFIED-TEST]**
  - `packages/shared-types/src/tag-template.spec.ts` **[VERIFIED-TEST]**
- **Compilation Gates**:
  - `npm run typecheck`: 0 errors across 5 workspaces **[VERIFIED-CODE]**
  - `npm run build:backend` (`nest build`): Successful dist output **[VERIFIED-CODE]**
  - `npm run build:web` (`vite build`): Successful dist output **[VERIFIED-CODE]**
- **Physical Device LAN Audit**:
  - Metro bundle delivered to physical Android 14 phone via `http://192.168.1.38:8081` **[VERIFIED-HARDWARE]**
  - Mobile PIN login against LAN NestJS API `http://192.168.1.38:3000/api` **[VERIFIED-HARDWARE]**

---

### 2.7 Git Commit History & Team Authorship

- **Commit History**: 183 commits inspected across branches `main`, `Developer-C-Delivery`, `Order_Workflow_Dev_B`, and `integration/developer-b-and-c`.
- **Author Attribution (Git Log)**:
  - `PrathameshBhagwat <bhagvatprathu@gmail.com>`: 126 commits (Lead / Developer C / Mobile) **[INFERRED-GIT]**
  - `Swapnil <swapnilofficial08@gmail.com>`: 41 commits (Developer B / Catalog & Order) **[INFERRED-GIT]**
  - `Sarthakgite06 <sarthakgite006@gmail.com>`: 16 commits (Developer A / Auth & Customer) **[INFERRED-GIT]**

---

### 2.8 Unverified Integrations & Limitations

- **ESC/POS Physical Printing**: Raw bytecode transmission to physical Zebra/Epson hardware is unverified due to lack of connected physical printer **[LIMITATION-GAP]**
- **Live WhatsApp Business Account**: Baileys multi-device socket provider is tested against mocked streams; active pairing requires a live WhatsApp phone number **[LIMITATION-GAP]**
- **Native iOS Execution**: Physical verification restricted to Android; iOS native testing requires Apple Developer certificate and Xcode build machine **[LIMITATION-GAP]**
