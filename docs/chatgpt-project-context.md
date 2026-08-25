# GrowFast Laundry Management System — ChatGPT Project Context & Knowledge Base

> **How to use this file:**
>
> 1. Upload this file to your **ChatGPT Project Files / Knowledge**.
> 2. Copy the **Project Instructions** section below into the **Custom Instructions** box of your ChatGPT Project.

---

# PART 1: Custom Project Instructions (Copy & Paste to ChatGPT)

```markdown
You are a senior full-stack lead software engineer and pair programmer on the GrowFast Laundry & Dry-Cleaning Management System.

### Project Architecture

- Monorepo using npm workspaces (`apps/*`, `packages/*`, `prisma/`, `docs/`)
- Backend: NestJS, TypeScript, Prisma ORM, PostgreSQL, bcryptjs PIN auth, JWT
- Frontend: React 19, Vite, TypeScript, Tailwind CSS v4, `@growfast/ui` design system
- Shared Packages: `@growfast/shared-types` (DTOs, Enums, canonical status logic), `@growfast/ui` (Design system)

### Mandatory Coding Rules

1. Never invent or duplicate business logic. Import types, enums, and DTOs from `@growfast/shared-types`.
2. Order status MUST ALWAYS be derived using `deriveOrderStatus()` from `@growfast/shared-types`. Never set order status manually.
3. Server-side authorization is mandatory on the backend using `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles()`. Frontend checks are UX hints only.
4. Financial and business-critical logic (pricing, balance, status transitions) must include unit tests.
5. Respect developer boundaries:
   - Developer A: Auth, Employee, Customer (Login, Customer Search/Profile/Details, Staff Management)
   - Developer B: Catalog, Order (Order Wizard, Order Details, Catalog Settings, Canonical Order Status)
   - Developer C: Photo, Delivery, Payment, Notification, Dashboard (Photo upload, Delivery tasks, Payments, KPI Dashboard)
6. Shared files (`prisma/schema.prisma`, `packages/shared-types`, `packages/ui`, `app.module.ts`, `App.tsx`) require strict coordination.
7. Mobile-first design: Components must have minimum 44px touch targets and accessible controls.
```

---

# PART 2: Complete Project Knowledge Base

## 1. Repository Structure

```
GrowFast/
├── apps/
│   ├── backend/                     # NestJS REST API
│   │   ├── src/
│   │   │   ├── auth/                # JWT strategy, guards, roles, PIN auth service
│   │   │   ├── health/              # Health check endpoint (/api/health)
│   │   │   ├── prisma/              # PrismaService & PrismaModule (global)
│   │   │   ├── app.module.ts        # Root NestJS module
│   │   │   └── main.ts              # Entry point (port 3000, prefix /api, CORS)
│   │   └── tsconfig.json
│   └── web/                         # React 19 + Vite PWA frontend
│       ├── src/
│       │   ├── components/          # App-specific components (ProtectedRoute)
│       │   ├── contexts/            # AuthContext (JWT, login, logout, localStorage)
│       │   ├── pages/               # LoginPage, HomePage
│       │   ├── App.tsx              # Router setup
│       │   ├── main.tsx             # Entry point
│       │   └── index.css            # Tailwind v4, CSS animations
│       └── vite.config.ts           # Path aliases (@/, @growfast/*), API proxy
├── packages/
│   ├── shared-types/                # Shared TypeScript contracts
│   │   └── src/
│   │       ├── enums.ts             # Role, OrderStatus, ItemStatus, PaymentStatus, etc.
│   │       ├── dto.ts               # API request/response contracts
│   │       ├── order-status.ts      # deriveOrderStatus() & ORDER_STATUS_COLORS
│   │       └── index.ts             # Barrel exports
│   └── ui/                          # Reusable design system
│       └── src/
│           ├── components/          # Button, Card, StatusChip, Input, Select, Modal,
│           │                        # NumericKeypadInput, WizardShell, ConfirmToast,
│           │                        # LoadingState, EmptyState, ErrorState, PhotoCapture
│           └── index.ts             # Barrel exports
├── prisma/
│   ├── schema.prisma                # PostgreSQL schema with 10 entities
│   └── seed.ts                      # Development seed data
├── docs/                            # Full project documentation
├── .github/
│   ├── workflows/ci.yml             # GitHub Actions CI pipeline
│   ├── ISSUE_TEMPLATE/              # Feature, bug, database change, task templates
│   └── pull_request_template.md     # Standard PR template
├── docker-compose.yml               # PostgreSQL 16 local setup
└── AGENTS.md                        # 26 mandatory development rules
```

---

## 2. Database Models (`prisma/schema.prisma`)

### Core Entities:

1. **`Store`**: Branch location (`id`, `name`, `address`, `phone`, `isActive`).
2. **`Employee`**: Staff (`id`, `name`, `email`, `pinHash`, `role`, `storeId`, `isActive`).
   - Roles: `OWNER`, `MANAGER`, `COUNTER`, `DELIVERY`.
3. **`Customer`**: Client (`id`, `name`, `phone` (unique), `email`, `address`, `pincode`, `membership`, `discountPercent`, `preferences`, `registrationSource`).
   - Memberships: `NONE`, `SILVER`, `GOLD`, `PLATINUM`.
4. **`GarmentCatalog`**: Garment types (`id`, `name`, `category`).
   - Categories: `MEN`, `WOMEN`, `KIDS`, `HOUSEHOLD`, `SHOES`, `SPECIAL`.
5. **`ServiceType`**: Service offered (`id`, `name`, `category`, `estimatedDays`).
   - Categories: `DRY_CLEAN`, `STEAM_PRESS`, `WASH`, `WASH_IRON`, `SHOE_CLEAN`, `LEATHER_CLEAN`, `STAIN_REMOVAL`, `WEIGHT_BASED`.
6. **`Order`**: Order header (`id`, `orderNumber` (unique), `customerId`, `orderDate`, `systemDueDate`, `effectiveDueDate`, `dueDateOverrideReason`, `dueDateOverriddenBy`, `isExpress`, `serviceSummary`, `status`, `subtotal`, `discountAmount`, `expressSurcharge`, `taxAmount`, `totalAmount`, `amountPaid`, `amountDue`, `paymentStatus`, `pickupType`, `priority`, `notes`, `syncStatus`, `createdById`, `storeId`).
   - Statuses: `RECEIVED`, `SORTING`, `PROCESSING`, `DRYING`, `IRONING`, `QUALITY_CHECK`, `PACKED`, `READY`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`.
   - Payment Statuses: `PENDING`, `PARTIAL`, `PAID`, `REFUNDED`.
   - Priorities: `STANDARD`, `EXPRESS`, `VIP`.
7. **`OrderItem`**: Item line (`id`, `orderId`, `garmentCatalogId`, `serviceTypeId`, `quantity`, `unitPrice`, `lineTotal`, `colorTags`, `defectNotes`, `itemStatus`, `deliveredQuantity`, `itemDueDate`).
   - Item Statuses: `RECEIVED`, `PROCESSING`, `QUALITY_CHECK`, `READY`, `DELIVERED`, `CANCELLED`.
8. **`OrderPhoto`**: Photo evidence (`id`, `orderId`, `orderItemId`, `type`, `url`, `uploadedAt`).
   - Types: `FRONT`, `BACK`, `DAMAGE`, `STAIN`, `TAG`, `DELIVERY_PROOF`.
9. **`Payment`**: Payment record (`id`, `orderId`, `amount`, `mode`, `reference`, `receivedById`, `createdAt`).
   - Modes: `CASH`, `UPI`, `CARD`, `ONLINE`, `STORE_CREDIT`.
10. **`DeliveryRecord`**: Delivery task (`id`, `orderId`, `address`, `riderId`, `status`, `scheduledAt`, `completedAt`, `proofPhotoUrl`, `notes`).
    - Statuses: `SCHEDULED`, `ASSIGNED`, `IN_TRANSIT`, `COMPLETED`, `FAILED`.

---

## 3. Shared Enums & Types (`@growfast/shared-types`)

### Key Types & DTOs:

- `deriveOrderStatus(itemStatuses: ItemStatus[]): OrderStatus`
  - Returns `RECEIVED` if all received
  - Returns `READY` if all items are ready or delivered (and at least 1 ready)
  - Returns `DELIVERED` only if ALL items are delivered
  - Returns `PROCESSING` if any item is actively in processing/QC/drying/ironing
- `ORDER_STATUS_COLORS[status]`: Returns `{ bg, text, border }` for UI chips.
- DTOs: `LoginRequest`, `LoginResponse`, `EmployeeSummary`, `CustomerDto`, `CreateCustomerRequest`, `CreateOrderRequest`, `OrderItemInput`, `PaymentDto`, `RecordPaymentRequest`, `DeliveryRecordDto`, etc.

---

## 4. UI Design System (`@growfast/ui`)

All components use Inter typography and support mobile touch targets:

- `<Button variant="primary|secondary|danger|ghost|outline" size="sm|md|lg" loading={bool} icon={ReactNode} fullWidth={bool}>`
- `<Card padding="none|sm|md|lg" elevated={bool} onClick={fn}>`
- `<StatusChip status={OrderStatus} size="sm|md">`
- `<Input label="Name" error="Required" helperText="..." fullWidth>`
- `<Select label="Service" options={[{ value, label }]} error="..." fullWidth>`
- `<Modal open={bool} onClose={fn} title="Dialog" width="480px">`
- `<NumericKeypadInput value={pin} onChange={setPin} maxLength={6} masked onSubmit={fn}>`
- `<WizardShell steps={[{ title, description }]} currentStep={n} onNext={fn} onBack={fn} onComplete={fn}>`
- `<ConfirmToast message="Saved" type="success|error|warning|info" visible={bool} onClose={fn}>`
- `<LoadingState message="Loading..." fullPage={bool}>`
- `<EmptyState title="No orders" message="..." icon={ReactNode} action={ReactNode}>`
- `<ErrorState title="Error" message="..." onRetry={fn}>`
- `<PhotoCapture onCapture={(file: File) => void} onRemove={fn} allowCamera={bool} label="Add Photo">`

---

## 5. Developer Ownership Matrix

| Developer       | Backend Domain                                                                       | Frontend Domain                                                                                       | Key Rules                                                                                              |
| --------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Developer A** | `src/auth/`, `src/employee/`, `src/customer/`                                        | `LoginPage`, `CustomerSearch`, `CustomerProfile`, `CustomerDetails`, `StaffManagement`, `AuthContext` | Handles auth, PIN validation, employee CRUD, customer lookup & profile                                 |
| **Developer B** | `src/catalog/`, `src/order/`                                                         | `OrderWizardPage`, `OrderDetailPage`, `MasterDataPage`, `CatalogSettingsPage`                         | Owns order creation, pricing math, due-date calculation, and canonical `deriveOrderStatus`             |
| **Developer C** | `src/photo/`, `src/delivery/`, `src/payment/`, `src/notification/`, `src/dashboard/` | `DeliveryPage`, `PhotoCaptureView`, `DashboardPage`                                                   | Implements photo upload, payment transactions, rider dispatch, KPI cards. MUST use `deriveOrderStatus` |

---

## 6. Integration Seams

1. **Customer → Order**: Customer Details page provides a "Create Order" button that routes to `/orders/new?customerId=:id` (Order Wizard).
2. **Order → Photo**: Order Wizard embeds `@growfast/ui` `PhotoCapture` and calls Developer C's `POST /api/photos/upload`.
3. **Delivery → Order Status**: Rider marking items delivered updates `deliveredQuantity` and recalculates order status via `deriveOrderStatus()`.
4. **Payment → Order**: Payment entry updates `amountPaid`, `amountDue`, and `paymentStatus` without affecting garment workflow status.

---

## 7. Development & Test Credentials

- **Owner**: ID `emp-owner-001` | PIN `111111`
- **Manager**: ID `emp-mgr-001` | PIN `222222`
- **Counter**: ID `emp-counter-001` | PIN `333333`
- **Delivery**: ID `emp-delivery-001` | PIN `444444`
