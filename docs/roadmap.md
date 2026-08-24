# Development Roadmap

## Phase 0 — Foundation ✅ (COMPLETED)

- Monorepo structure with npm workspaces (`apps/`, `packages/`, `prisma/`, `docs/`)
- PostgreSQL schema with 10 entities, relations, indexes, and constraints
- Prisma seed script with development stores, employees, catalog, customers, and test orders
- NestJS backend with JWT authentication, bcryptjs PIN hashing, `@Roles()` decorator, and `RolesGuard`
- Backend unit tests (8 passing tests)
- React frontend with Vite, Tailwind CSS v4, `AuthContext`, `ProtectedRoute`, `LoginPage`, and `HomePage`
- Shared types package (`@growfast/shared-types`) with canonical `deriveOrderStatus()` logic
- UI design system package (`@growfast/ui`) with 12 mobile-first components and `PhotoCapture` contract
- GitHub Actions CI workflow, PR template, issue templates, and comprehensive documentation

---

## Phase 1 — Core Business Features (Team Parallel Development)

### Developer A (Auth / Employee / Customer)

- **A1: Customer Search** — Backend search endpoint by phone/name, frontend search UI with quick selection.
- **A2: Customer Creation** — Quick customer intake form at counter with phone uniqueness validation.
- **A3: Customer Profile** — Customer details view (name, phone, address, tier, preferences, discount %).
- **A4: Customer Details** — Detailed customer profile editing, preferences (fragrance, starch, fold), and membership tier.
- **A5: Customer Order History** — Paginated list of previous orders for a customer with status and balance summary.
- **A6: Employee/Staff Management** — Owner-only staff list, role assignment (MANAGER/COUNTER/DELIVERY), and PIN reset.

### Developer B (Catalog / Order)

- **B1: Catalog Management** — Garment catalog list and category filtering (MEN, WOMEN, KIDS, HOUSEHOLD, SHOES, SPECIAL).
- **B2: Service Type Management** — Service types (Dry Clean, Steam Press, Wash, etc.) with estimated processing days.
- **B3: Order Creation Wizard** — Multi-step intake flow (Customer selection → Garments & Services → Review & Confirm).
- **B4: Order Items** — Individual garment tagging, color notes, defect/stain documentation, and item status tracking.
- **B5: Pricing & Calculations** — Line total calculation, subtotal, discount application, and tax amounts.
- **B6: Due Date Calculation** — System-calculated due date based on max service estimated days; Manager override with audit log.
- **B7: Express Pricing** — Express service flag, express surcharge calculation, and priority scheduling.
- **B8: Order Status Derivation Integration** — Integration of `deriveOrderStatus()` across all order lifecycle updates.

### Developer C (Photo / Delivery / Payment / Notification / Dashboard)

- **C1: Photo Infrastructure** — Cloud / local storage service integration for order and defect photos.
- **C2: Photo Upload** — Backend photo upload endpoints linked to `Order` and `OrderItem` records.
- **C3: Payment Recording** — Payment intake (Cash, UPI, Card) with transaction references and employee tracking.
- **C4: Payment Status** — Automatic status updates (`PENDING` → `PARTIAL` → `PAID`) based on total vs paid amount.
- **C5: Delivery Tasks** — Driver dispatch task list, home delivery scheduling, and address routing info.
- **C6: Partial Delivery** — Partial item delivery reconciliation (`deliveredQuantity`) and proof-of-delivery photo capture.
- **C7: Dashboard & KPIs** — Manager and Owner KPI dashboard (Daily revenue, pending orders, delayed orders, ready orders).
- **C8: Notification Foundation** — Event hooks for SMS / WhatsApp customer notifications upon status change.

---

## Phase 1 Integration Seams

1. **Customer → Order:** Customer Details (Dev A) triggers "Create Order" routing into Order Wizard (Dev B).
2. **Order → Photo:** Order Wizard (Dev B) captures photos via shared `PhotoCapture` and uploads via Photo Service (Dev C).
3. **Delivery → Order Status:** Delivery quantity updates (Dev C) trigger canonical `deriveOrderStatus()` (owned by Dev B in `shared-types`).
4. **Payment → Order:** Payment intake (Dev C) updates Order financial balances independently from delivery status.

---

## Phase 2 — Operational Excellence

- Garment processing barcode/QR tag workflow
- Packing station and rack location management
- Quality check (QC) handler workflow
- Automated customer SMS notifications
- End-of-day cash drawer reconciliation report

## Phase 3 — Analytics & Store Operations

- Owner revenue and profitability analytics
- Customer retention and frequency reports
- Store expense tracking and petty cash
- Multi-store branch reporting

## Phase 4 — Mobile & PWA Offline Sync

- Progressive Web App offline caching via Service Worker
- Local IndexedDB storage and sync conflict resolution (`SyncStatus`)
- Rider mobile delivery interface with GPS
- WhatsApp Business API integration
