# GrowFast Laundry Management System — Developer C Complete Context

> **Target Role:** Developer C (Photo, Delivery, Payment, Notification, Dashboard)  
> **Repository:** GrowFast Monorepo  
> **Instructions for ChatGPT:**  
> You are collaborating with **Developer C** on the GrowFast Laundry & Dry-Cleaning Management System.  
> Developer C is exclusively responsible for the backend modules (`photo`, `delivery`, `payment`, `notification`, `dashboard`) and the frontend pages (`DeliveryPage`, `PhotoCaptureView`, `DashboardPage`).  
> All business logic regarding order status updates must strictly call `deriveOrderStatus()` from `@growfast/shared-types`.  
> All backend routes must be secured using `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles()`.

---

## Table of Contents

1. [Developer C Scope & Architectural Boundaries](#1-developer-c-scope--architectural-boundaries)
2. [AGENTS.md (Development Rules & Guidelines)](#2-agentsmd)
3. [packages/shared-types/src/enums.ts](#3-packagesshared-typessrcenumsts)
4. [packages/shared-types/src/dto.ts](#4-packagesshared-typessrcdtots)
5. [packages/shared-types/src/order-status.ts](#5-packagesshared-typessrcorder-statusts)
6. [packages/shared-types/src/index.ts](#6-packagesshared-typessrcindexts)
7. [packages/ui/src/components/PhotoCapture.tsx](#7-packagesuisrccomponentsphotocapturetsx)
8. [packages/ui/src/index.ts](#8-packagesuisrcindexts)
9. [prisma/schema.prisma](#9-prismaschemaprisma)
10. [apps/backend/src/app.module.ts](#10-appsbackendsrcappmodulets)
11. [apps/backend/src/main.ts](#11-appsbackendsrcmaints)
12. [apps/backend/src/*/ (Existing Module Architecture & Guards)](#12-appsbackendsrc-existing-module-architecture--guards)
13. [package.json (Root Workspace)](#13-packagejson-root-workspace)

---

## 1. Developer C Scope & Architectural Boundaries

### Assigned Modules & Components

- **Backend Ownership (`apps/backend/src/`):**
  - `photo/` — Photo storage & retrieval (`POST /api/photos/upload`, `GET /api/orders/:id/photos`)
  - `delivery/` — Delivery scheduling, driver task list, status updates, proof of delivery (`GET /api/deliveries`, `PATCH /api/deliveries/:id`, `POST /api/deliveries/:id/proof`)
  - `payment/` — Payment transaction logging, balance reconciliation (`POST /api/payments`, `GET /api/orders/:id/payments`)
  - `notification/` — SMS/WhatsApp alert dispatch hooks & event listeners
  - `dashboard/` — Manager & Owner KPI aggregations, revenue analytics (`GET /api/dashboard/summary`, `GET /api/dashboard/revenue`)
- **Frontend Ownership (`apps/web/src/pages/`):**
  - `DeliveryPage.tsx` — Driver delivery run sheet, task status transitions, camera delivery proof
  - `PhotoCaptureView.tsx` — Garment intake & defect photo gallery / inspection
  - `DashboardPage.tsx` — High-level metric cards, daily turnover, pending orders, delivery performance

### Critical Domain Rules for Developer C

1. **Never Manually Set Order Status:** Order status must always be derived using `deriveOrderStatus(items)` from `@growfast/shared-types`. When delivery marks items delivered (`deliveredQuantity`), recalculate and update order status accordingly.
2. **Server-Side Authorization:** Every controller endpoint must be protected with `@UseGuards(JwtAuthGuard, RolesGuard)` and appropriate `@Roles(...)`.
3. **Respect Shared Contracts:** Photo services must align with `@growfast/ui`'s `PhotoCapture` interface.
4. **Payment Math:** Balance calculations (`amountPaid`, `amountDue`, `paymentStatus`) must be unit tested.

---

## 2. AGENTS.md

```markdown
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
backend/ → NestJS REST API
web/ → React PWA frontend

packages/
shared-types/ → Shared enums, DTOs, contracts
ui/ → Reusable design system components

prisma/ → Database schema and migrations
docs/ → Project documentation

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
```

---

## 3. packages/shared-types/src/enums.ts

```typescript
/**
 * Shared enums for the Laundry Management System.
 * Used by both backend and frontend — do NOT duplicate these.
 */

// ─── Employee & Auth ───────────────────────────────────────────────

export enum Role {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  COUNTER = 'COUNTER',
  DELIVERY = 'DELIVERY',
}

// ─── Order Lifecycle ────────────────────────────────────────────────

export enum OrderStatus {
  RECEIVED = 'RECEIVED',
  SORTING = 'SORTING',
  PROCESSING = 'PROCESSING',
  DRYING = 'DRYING',
  IRONING = 'IRONING',
  QUALITY_CHECK = 'QUALITY_CHECK',
  PACKED = 'PACKED',
  READY = 'READY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum ItemStatus {
  RECEIVED = 'RECEIVED',
  PROCESSING = 'PROCESSING',
  QUALITY_CHECK = 'QUALITY_CHECK',
  READY = 'READY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

// ─── Payment ────────────────────────────────────────────────────────

export enum PaymentStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMode {
  CASH = 'CASH',
  UPI = 'UPI',
  CARD = 'CARD',
  ONLINE = 'ONLINE',
  STORE_CREDIT = 'STORE_CREDIT',
}

// ─── Pickup & Delivery ─────────────────────────────────────────────

export enum PickupType {
  STORE_PICKUP = 'STORE_PICKUP',
  HOME_DELIVERY = 'HOME_DELIVERY',
}

export enum DeliveryStatus {
  SCHEDULED = 'SCHEDULED',
  ASSIGNED = 'ASSIGNED',
  IN_TRANSIT = 'IN_TRANSIT',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// ─── Photos ─────────────────────────────────────────────────────────

export enum PhotoType {
  FRONT = 'FRONT',
  BACK = 'BACK',
  DAMAGE = 'DAMAGE',
  STAIN = 'STAIN',
  TAG = 'TAG',
  DELIVERY_PROOF = 'DELIVERY_PROOF',
}

// ─── Sync (for future offline support) ─────────────────────────────

export enum SyncStatus {
  SYNCED = 'SYNCED',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
}

// ─── Garment & Service ─────────────────────────────────────────────

export enum GarmentCategory {
  MEN = 'MEN',
  WOMEN = 'WOMEN',
  KIDS = 'KIDS',
  HOUSEHOLD = 'HOUSEHOLD',
  SHOES = 'SHOES',
  SPECIAL = 'SPECIAL',
}

export enum ServiceCategory {
  DRY_CLEAN = 'DRY_CLEAN',
  STEAM_PRESS = 'STEAM_PRESS',
  WASH = 'WASH',
  WASH_IRON = 'WASH_IRON',
  SHOE_CLEAN = 'SHOE_CLEAN',
  LEATHER_CLEAN = 'LEATHER_CLEAN',
  STAIN_REMOVAL = 'STAIN_REMOVAL',
  WEIGHT_BASED = 'WEIGHT_BASED',
}

// ─── Order Priority ─────────────────────────────────────────────────

export enum OrderPriority {
  STANDARD = 'STANDARD',
  EXPRESS = 'EXPRESS',
  VIP = 'VIP',
}

// ─── QC Status ──────────────────────────────────────────────────────

export enum QCStatus {
  PENDING = 'PENDING',
  PASSED = 'PASSED',
  REWORK = 'REWORK',
  ISSUE = 'ISSUE',
}

// ─── Customer Membership ────────────────────────────────────────────

export enum MembershipTier {
  NONE = 'NONE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

// ─── Registration Source ────────────────────────────────────────────

export enum RegistrationSource {
  WALK_IN = 'WALK_IN',
  PHONE = 'PHONE',
  WEBSITE = 'WEBSITE',
  REFERRAL = 'REFERRAL',
  APP = 'APP',
}
```

---

## 4. packages/shared-types/src/dto.ts

```typescript
/**
 * API DTO contracts — shared between backend and frontend.
 * Backend uses these as response shapes; frontend uses them for type-safe API calls.
 */

import {
  Role,
  OrderStatus,
  PaymentStatus,
  PaymentMode,
  PickupType,
  OrderPriority,
  GarmentCategory,
  ServiceCategory,
  ItemStatus,
  PhotoType,
  MembershipTier,
  DeliveryStatus,
} from './enums';

// ─── Auth DTOs ──────────────────────────────────────────────────────

export interface LoginRequest {
  employeeId: string;
  pin: string;
}

export interface LoginResponse {
  accessToken: string;
  employee: EmployeeSummary;
}

export interface EmployeeSummary {
  id: string;
  name: string;
  role: Role;
  storeId: string;
  storeName: string;
}

// ─── Customer DTOs ──────────────────────────────────────────────────

export interface CustomerDTO {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  pincode: string | null;
  membership: MembershipTier;
  discountPercent: number;
  preferences: Record<string, string> | null;
  registrationSource: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerRequest {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  pincode?: string;
  membership?: MembershipTier;
  discountPercent?: number;
  preferences?: Record<string, string>;
  registrationSource?: string;
}

// ─── Order DTOs ─────────────────────────────────────────────────────

export interface OrderSummaryDTO {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  orderDate: string;
  effectiveDueDate: string;
  isExpress: boolean;
  priority: OrderPriority;
  status: OrderStatus;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  paymentStatus: PaymentStatus;
  pickupType: PickupType;
  itemCount: number;
}

export interface OrderDetailDTO extends OrderSummaryDTO {
  systemDueDate: string;
  dueDateOverrideReason: string | null;
  dueDateOverriddenBy: string | null;
  serviceSummary: string | null;
  storeId: string;
  createdById: string;
  createdByName: string;
  items: OrderItemDTO[];
  payments: PaymentDTO[];
}

export interface OrderItemDTO {
  id: string;
  garmentName: string;
  garmentCategory: GarmentCategory;
  serviceType: ServiceCategory;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  colorTags: string[] | null;
  defectNotes: string | null;
  itemStatus: ItemStatus;
  deliveredQuantity: number;
  itemDueDate: string | null;
}

export interface CreateOrderRequest {
  customerId: string;
  isExpress: boolean;
  pickupType: PickupType;
  items: CreateOrderItemRequest[];
  notes?: string;
}

export interface CreateOrderItemRequest {
  garmentCatalogId: string;
  serviceTypeId: string;
  quantity: number;
  colorTags?: string[];
  defectNotes?: string;
}

// ─── Payment DTOs ───────────────────────────────────────────────────

export interface PaymentDTO {
  id: string;
  orderId: string;
  amount: number;
  mode: PaymentMode;
  reference: string | null;
  receivedById: string;
  receivedByName: string;
  createdAt: string;
}

export interface RecordPaymentRequest {
  orderId: string;
  amount: number;
  mode: PaymentMode;
  reference?: string;
}

// ─── Catalog DTOs ───────────────────────────────────────────────────

export interface GarmentCatalogDTO {
  id: string;
  name: string;
  category: GarmentCategory;
  isActive: boolean;
}

export interface ServiceTypeDTO {
  id: string;
  name: string;
  category: ServiceCategory;
  estimatedDays: number;
  isActive: boolean;
}

// ─── Photo DTOs ─────────────────────────────────────────────────────

export interface OrderPhotoDTO {
  id: string;
  orderItemId: string;
  type: PhotoType;
  url: string;
  uploadedAt: string;
}

// ─── Delivery DTOs ──────────────────────────────────────────────────

export interface DeliveryRecordDTO {
  id: string;
  orderId: string;
  address: string;
  riderId: string | null;
  riderName: string | null;
  status: DeliveryStatus;
  scheduledAt: string | null;
  completedAt: string | null;
  proofPhotoUrl: string | null;
  notes: string | null;
}

// ─── API Response Wrappers ──────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  success: false;
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}
```

---

## 5. packages/shared-types/src/order-status.ts

```typescript
/**
 * Order status derivation — single source of truth.
 *
 * This function determines the canonical order status based on
 * the statuses of all items within the order.
 *
 * IMPORTANT:
 * - Order status must NOT be manually set by delivery or other modules.
 * - All modules (delivery, payment, processing) must call this function
 *   to derive the order status from item-level statuses.
 * - There must be ONE source of truth for order status derivation.
 */

import { OrderStatus, ItemStatus } from './enums';

export interface OrderItemStatusInput {
  status: ItemStatus;
  deliveredQuantity: number;
  totalQuantity: number;
}

/**
 * Derive the overall order status from individual item statuses.
 *
 * Rules:
 * 1. If ALL items are DELIVERED → DELIVERED
 * 2. If ANY item is OUT_FOR_DELIVERY → OUT_FOR_DELIVERY
 * 3. If ALL items are READY or DELIVERED → READY
 * 4. If ALL items have passed QC (READY+) → PACKED
 * 5. If ANY item is in QUALITY_CHECK → QUALITY_CHECK
 * 6. If ANY item is PROCESSING → PROCESSING
 * 7. If ALL items are RECEIVED → RECEIVED
 * 8. If ALL items are CANCELLED → CANCELLED
 * 9. Otherwise → the lowest-progress status among non-cancelled items
 */
export function deriveOrderStatus(items: OrderItemStatusInput[]): OrderStatus {
  if (items.length === 0) {
    return OrderStatus.RECEIVED;
  }

  const nonCancelled = items.filter((i) => i.status !== ItemStatus.CANCELLED);

  // All cancelled
  if (nonCancelled.length === 0) {
    return OrderStatus.CANCELLED;
  }

  // All delivered
  if (nonCancelled.every((i) => i.status === ItemStatus.DELIVERED)) {
    return OrderStatus.DELIVERED;
  }

  // All ready or delivered
  if (
    nonCancelled.every((i) => i.status === ItemStatus.READY || i.status === ItemStatus.DELIVERED)
  ) {
    return OrderStatus.READY;
  }

  // Any in quality check
  if (nonCancelled.some((i) => i.status === ItemStatus.QUALITY_CHECK)) {
    return OrderStatus.QUALITY_CHECK;
  }

  // Any processing
  if (nonCancelled.some((i) => i.status === ItemStatus.PROCESSING)) {
    return OrderStatus.PROCESSING;
  }

  // Default: received
  return OrderStatus.RECEIVED;
}

/**
 * STATUS COLOR MAPPING — for consistent UI rendering.
 * The StatusChip component in packages/ui must use these colors.
 */
export const ORDER_STATUS_COLORS: Record<
  OrderStatus,
  { bg: string; text: string; border: string }
> = {
  [OrderStatus.RECEIVED]: { bg: '#F0F9FF', text: '#075985', border: '#BAE6FD' },
  [OrderStatus.SORTING]: { bg: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE' },
  [OrderStatus.PROCESSING]: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  [OrderStatus.DRYING]: { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA' },
  [OrderStatus.IRONING]: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  [OrderStatus.QUALITY_CHECK]: { bg: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE' },
  [OrderStatus.PACKED]: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  [OrderStatus.READY]: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  [OrderStatus.OUT_FOR_DELIVERY]: { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
  [OrderStatus.DELIVERED]: { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
  [OrderStatus.CANCELLED]: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
};
```

---

## 6. packages/shared-types/src/index.ts

```typescript
/**
 * @growfast/shared-types
 *
 * Shared TypeScript enums, DTOs, and contracts used by both
 * the backend (NestJS) and frontend (React) applications.
 *
 * IMPORTANT: Do NOT duplicate these types in individual apps.
 * Import from '@growfast/shared-types' instead.
 */

// Enums
export {
  Role,
  OrderStatus,
  ItemStatus,
  PaymentStatus,
  PaymentMode,
  PickupType,
  DeliveryStatus,
  PhotoType,
  SyncStatus,
  GarmentCategory,
  ServiceCategory,
  OrderPriority,
  QCStatus,
  MembershipTier,
  RegistrationSource,
} from './enums';

// DTOs
export type {
  LoginRequest,
  LoginResponse,
  EmployeeSummary,
  CustomerDTO,
  CreateCustomerRequest,
  OrderSummaryDTO,
  OrderDetailDTO,
  OrderItemDTO,
  CreateOrderRequest,
  CreateOrderItemRequest,
  PaymentDTO,
  RecordPaymentRequest,
  GarmentCatalogDTO,
  ServiceTypeDTO,
  OrderPhotoDTO,
  DeliveryRecordDTO,
  ApiResponse,
  PaginatedResponse,
  ApiError,
} from './dto';

// Order Status Contract
export { deriveOrderStatus, ORDER_STATUS_COLORS } from './order-status';
export type { OrderItemStatusInput } from './order-status';
```

---

## 7. packages/ui/src/components/PhotoCapture.tsx

```tsx
import React, { useRef, useState } from 'react';
import { Camera, Upload, X, RotateCcw } from 'lucide-react';
import { Button } from './Button';

export interface PhotoCaptureProps {
  /** Called when a photo is captured or selected */
  onCapture: (file: File) => void;
  /** Optional: called when a captured photo is removed */
  onRemove?: () => void;
  /** Whether to show camera option vs file-only */
  allowCamera?: boolean;
  /** Accept filter for file input */
  accept?: string;
  /** Optional label */
  label?: string;
}

/**
 * PhotoCapture — reusable component contract for photo capture.
 *
 * Supports:
 * - Camera capture (via media capture)
 * - File selection from gallery
 * - Preview with retake/remove
 *
 * NOTE: Actual cloud upload integration is NOT implemented in UI package.
 * Developer C will implement the upload service in backend and wire it.
 * This component only handles capture and provides the File
 * to the parent via onCapture callback.
 */
export const PhotoCapture: React.FC<PhotoCaptureProps> = ({
  onCapture,
  onRemove,
  allowCamera = true,
  accept = 'image/*',
  label = 'Add Photo',
}) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const url = URL.createObjectURL(file);
      setPreview(url);
      onCapture(file);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    onRemove?.();
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    fontFamily: "'Inter', sans-serif",
  };

  if (preview) {
    return (
      <div style={containerStyle}>
        {label && (
          <span style={{ fontSize: '0.84rem', fontWeight: 500, color: '#334155' }}>{label}</span>
        )}
        <div
          style={{
            position: 'relative',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #E2E8F0',
          }}
        >
          <img
            src={preview}
            alt="Captured"
            style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', display: 'block' }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              display: 'flex',
              gap: '8px',
            }}
          >
            <Button
              variant="secondary"
              size="sm"
              icon={<RotateCcw size={14} />}
              onClick={() => fileInputRef.current?.click()}
            >
              Retake
            </Button>
            <Button variant="danger" size="sm" icon={<X size={14} />} onClick={handleRemove}>
              Remove
            </Button>
          </div>
        </div>
        {fileName && <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{fileName}</span>}
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {label && (
        <span style={{ fontSize: '0.84rem', fontWeight: 500, color: '#334155' }}>{label}</span>
      )}
      <div style={{ display: 'flex', gap: '10px' }}>
        {allowCamera && (
          <>
            <Button
              variant="outline"
              size="md"
              icon={<Camera size={18} />}
              onClick={() => cameraInputRef.current?.click()}
            >
              Camera
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept={accept}
              capture="environment"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </>
        )}
        <Button
          variant="secondary"
          size="md"
          icon={<Upload size={18} />}
          onClick={() => fileInputRef.current?.click()}
        >
          Gallery
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};
```

---

## 8. packages/ui/src/index.ts

```typescript
export { Button } from './components/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/Button';

export { Card } from './components/Card';
export type { CardProps } from './components/Card';

export { StatusChip } from './components/StatusChip';
export type { StatusChipProps } from './components/StatusChip';

export { Input } from './components/Input';
export type { InputProps } from './components/Input';

export { Select } from './components/Select';
export type { SelectProps, SelectOption } from './components/Select';

export { Modal } from './components/Modal';
export type { ModalProps } from './components/Modal';

export { NumericKeypadInput } from './components/NumericKeypadInput';
export type { NumericKeypadInputProps } from './components/NumericKeypadInput';

export { WizardShell } from './components/WizardShell';
export type { WizardShellProps, WizardStep } from './components/WizardShell';

export { ConfirmToast } from './components/ConfirmToast';
export type { ConfirmToastProps, ToastType } from './components/ConfirmToast';

export { LoadingState } from './components/LoadingState';
export type { LoadingStateProps } from './components/LoadingState';

export { EmptyState } from './components/EmptyState';
export type { EmptyStateProps } from './components/EmptyState';

export { ErrorState } from './components/ErrorState';
export type { ErrorStateProps } from './components/ErrorState';

export { PhotoCapture } from './components/PhotoCapture';
export type { PhotoCaptureProps } from './components/PhotoCapture';
```

---

## 9. prisma/schema.prisma

```prisma
// This is your Prisma schema file.
// Learn more: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── STORE ──────────────────────────────────────────────────────────

model Store {
  id        String   @id @default(cuid())
  name      String
  address   String?
  phone     String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  employees Employee[]
  orders    Order[]

  @@map("stores")
}

// ─── EMPLOYEE ───────────────────────────────────────────────────────

model Employee {
  id        String   @id @default(cuid())
  name      String
  phone     String?
  email     String?  @unique
  pinHash   String   @map("pin_hash")
  role      Role
  storeId   String   @map("store_id")
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  store             Store            @relation(fields: [storeId], references: [id])
  createdOrders     Order[]          @relation("OrderCreatedBy")
  receivedPayments  Payment[]        @relation("PaymentReceivedBy")
  deliveryRecords   DeliveryRecord[] @relation("DeliveryRider")

  @@index([storeId])
  @@index([role])
  @@index([isActive])
  @@map("employees")
}

enum Role {
  OWNER
  MANAGER
  COUNTER
  DELIVERY
}

// ─── CUSTOMER ───────────────────────────────────────────────────────

model Customer {
  id                 String          @id @default(cuid())
  name               String
  phone              String          @unique
  email              String?
  address            String?
  pincode            String?
  membership         MembershipTier  @default(NONE)
  discountPercent    Float           @default(0)
  preferences        Json?           // fragrance, starch, fold pref, etc.
  registrationSource String          @default("WALK_IN") @map("registration_source")
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt

  orders Order[]

  @@index([phone])
  @@index([name])
  @@map("customers")
}

enum MembershipTier {
  NONE
  SILVER
  GOLD
  PLATINUM
}

// ─── GARMENT CATALOG ────────────────────────────────────────────────

model GarmentCatalog {
  id        String          @id @default(cuid())
  name      String
  category  GarmentCategory
  isActive  Boolean         @default(true)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt

  orderItems OrderItem[]

  @@index([category])
  @@map("garment_catalog")
}

enum GarmentCategory {
  MEN
  WOMEN
  KIDS
  HOUSEHOLD
  SHOES
  SPECIAL
}

// ─── SERVICE TYPE ───────────────────────────────────────────────────

model ServiceType {
  id            String          @id @default(cuid())
  name          String
  category      ServiceCategory
  estimatedDays Int             @default(2)
  isActive      Boolean         @default(true)
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  orderItems OrderItem[]

  @@index([category])
  @@map("service_types")
}

enum ServiceCategory {
  DRY_CLEAN
  STEAM_PRESS
  WASH
  WASH_IRON
  SHOE_CLEAN
  LEATHER_CLEAN
  STAIN_REMOVAL
  WEIGHT_BASED
}

// ─── ORDER ──────────────────────────────────────────────────────────

model Order {
  id                     String        @id @default(cuid())
  orderNumber            String        @unique @map("order_number")
  customerId             String        @map("customer_id")
  orderDate              DateTime      @default(now()) @map("order_date")
  systemDueDate          DateTime      @map("system_due_date")
  effectiveDueDate       DateTime      @map("effective_due_date")
  dueDateOverrideReason  String?       @map("due_date_override_reason")
  dueDateOverriddenBy    String?       @map("due_date_overridden_by")
  isExpress              Boolean       @default(false) @map("is_express")
  serviceSummary         String?       @map("service_summary")
  status                 OrderStatus   @default(RECEIVED)
  subtotal               Float         @default(0)
  discountAmount         Float         @default(0) @map("discount_amount")
  expressSurcharge       Float         @default(0) @map("express_surcharge")
  taxAmount              Float         @default(0) @map("tax_amount")
  totalAmount            Float         @default(0) @map("total_amount")
  amountPaid             Float         @default(0) @map("amount_paid")
  amountDue              Float         @default(0) @map("amount_due")
  paymentStatus          PaymentStatus @default(PENDING) @map("payment_status")
  pickupType             PickupType    @default(STORE_PICKUP) @map("pickup_type")
  priority               OrderPriority @default(STANDARD)
  notes                  String?
  syncStatus             SyncStatus    @default(SYNCED) @map("sync_status")
  createdById            String        @map("created_by_id")
  storeId                String        @map("store_id")
  createdAt              DateTime      @default(now())
  updatedAt              DateTime      @updatedAt

  customer        Customer         @relation(fields: [customerId], references: [id])
  createdBy       Employee         @relation("OrderCreatedBy", fields: [createdById], references: [id])
  store           Store            @relation(fields: [storeId], references: [id])
  items           OrderItem[]
  payments        Payment[]
  photos          OrderPhoto[]
  deliveryRecords DeliveryRecord[]

  @@index([customerId])
  @@index([status])
  @@index([paymentStatus])
  @@index([orderDate])
  @@index([storeId])
  @@index([createdById])
  @@map("orders")
}

enum OrderStatus {
  RECEIVED
  SORTING
  PROCESSING
  DRYING
  IRONING
  QUALITY_CHECK
  PACKED
  READY
  OUT_FOR_DELIVERY
  DELIVERED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  PARTIAL
  PAID
  REFUNDED
}

enum PickupType {
  STORE_PICKUP
  HOME_DELIVERY
}

enum OrderPriority {
  STANDARD
  EXPRESS
  VIP
}

enum SyncStatus {
  SYNCED
  PENDING
  FAILED
}

// ─── ORDER ITEM ─────────────────────────────────────────────────────

model OrderItem {
  id                String       @id @default(cuid())
  orderId           String       @map("order_id")
  garmentCatalogId  String       @map("garment_catalog_id")
  serviceTypeId     String       @map("service_type_id")
  quantity          Int          @default(1)
  unitPrice         Float        @map("unit_price")
  lineTotal         Float        @map("line_total")
  colorTags         String[]     @default([]) @map("color_tags")
  defectNotes       String?      @map("defect_notes")
  itemStatus        ItemStatus   @default(RECEIVED) @map("item_status")
  deliveredQuantity Int          @default(0) @map("delivered_quantity")
  itemDueDate       DateTime?    @map("item_due_date")
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  order          Order          @relation(fields: [orderId], references: [id], onDelete: Cascade)
  garmentCatalog GarmentCatalog @relation(fields: [garmentCatalogId], references: [id])
  serviceType    ServiceType    @relation(fields: [serviceTypeId], references: [id])
  photos         OrderPhoto[]

  @@index([orderId])
  @@index([itemStatus])
  @@map("order_items")
}

enum ItemStatus {
  RECEIVED
  PROCESSING
  QUALITY_CHECK
  READY
  DELIVERED
  CANCELLED
}

// ─── ORDER PHOTO ────────────────────────────────────────────────────

model OrderPhoto {
  id          String    @id @default(cuid())
  orderId     String    @map("order_id")
  orderItemId String?   @map("order_item_id")
  type        PhotoType
  url         String
  uploadedAt  DateTime  @default(now()) @map("uploaded_at")

  order     Order      @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderItem OrderItem? @relation(fields: [orderItemId], references: [id], onDelete: SetNull)

  @@index([orderId])
  @@index([orderItemId])
  @@map("order_photos")
}

enum PhotoType {
  FRONT
  BACK
  DAMAGE
  STAIN
  TAG
  DELIVERY_PROOF
}

// ─── PAYMENT ────────────────────────────────────────────────────────

model Payment {
  id           String      @id @default(cuid())
  orderId      String      @map("order_id")
  amount       Float
  mode         PaymentMode
  reference    String?
  receivedById String      @map("received_by_id")
  createdAt    DateTime    @default(now())

  order      Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  receivedBy Employee @relation("PaymentReceivedBy", fields: [receivedById], references: [id])

  @@index([orderId])
  @@map("payments")
}

enum PaymentMode {
  CASH
  UPI
  CARD
  ONLINE
  STORE_CREDIT
}

// ─── DELIVERY RECORD ────────────────────────────────────────────────

model DeliveryRecord {
  id            String         @id @default(cuid())
  orderId       String         @map("order_id")
  address       String
  riderId       String?        @map("rider_id")
  status        DeliveryStatus @default(SCHEDULED)
  scheduledAt   DateTime?      @map("scheduled_at")
  completedAt   DateTime?      @map("completed_at")
  proofPhotoUrl String?        @map("proof_photo_url")
  notes         String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  order Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  rider Employee? @relation("DeliveryRider", fields: [riderId], references: [id])

  @@index([orderId])
  @@index([riderId])
  @@index([status])
  @@map("delivery_records")
}

enum DeliveryStatus {
  SCHEDULED
  ASSIGNED
  IN_TRANSIT
  COMPLETED
  FAILED
}
```

---

## 10. apps/backend/src/app.module.ts

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [PrismaModule, AuthModule, HealthModule],
})
export class AppModule {}
```

---

## 11. apps/backend/src/main.ts

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix for all API routes
  app.setGlobalPrefix('api');

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}/api`);
}

bootstrap();
```

---

## 12. apps/backend/src/*/ (Existing Module Architecture & Guards)

### Current Structure:

```
apps/backend/src/
├── app.module.ts
├── main.ts
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── health/
│   ├── health.controller.ts
│   └── health.module.ts
├── auth/
│   ├── auth.controller.ts
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── auth.service.spec.ts
│   ├── jwt.strategy.ts
│   ├── jwt-auth.guard.ts
│   ├── roles.guard.ts
│   └── roles.decorator.ts
└── [Developer C Modules To Create]:
    ├── photo/
    ├── delivery/
    ├── payment/
    ├── notification/
    └── dashboard/
```

### Shared Guards & Decorators to Import in Developer C Modules:

#### `apps/backend/src/auth/jwt-auth.guard.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

#### `apps/backend/src/auth/roles.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: no role assigned');
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied: requires one of [${requiredRoles.join(', ')}], but you have [${user.role}]`,
      );
    }

    return true;
  }
}
```

#### `apps/backend/src/auth/roles.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

#### `apps/backend/src/prisma/prisma.service.ts`

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

---

## 13. package.json (Root Workspace)

```json
{
  "name": "growfast-laundry",
  "private": true,
  "version": "0.1.0",
  "description": "Laundry & Dry-Cleaning Management System",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm run dev --workspace=apps/backend & npm run dev --workspace=apps/web",
    "dev:backend": "npm run dev --workspace=apps/backend",
    "dev:web": "npm run dev --workspace=apps/web",
    "build": "npm run build --workspaces --if-present",
    "build:backend": "npm run build --workspace=apps/backend",
    "build:web": "npm run build --workspace=apps/web",
    "build:shared": "npm run build --workspace=packages/shared-types",
    "lint": "npm run lint --workspaces --if-present",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "db:migrate": "npx prisma migrate dev --schema=prisma/schema.prisma",
    "db:migrate:deploy": "npx prisma migrate deploy --schema=prisma/schema.prisma",
    "db:seed": "npx tsx prisma/seed.ts",
    "db:generate": "npx prisma generate --schema=prisma/schema.prisma",
    "db:studio": "npx prisma studio --schema=prisma/schema.prisma",
    "db:reset": "npx prisma migrate reset --schema=prisma/schema.prisma --force",
    "clean": "rimraf apps/*/dist apps/*/node_modules packages/*/dist packages/*/node_modules node_modules"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "bcryptjs": "^2.4.3",
    "prettier": "^3.3.0",
    "prisma": "^5.20.0",
    "rimraf": "^6.0.0",
    "tsx": "^4.19.0",
    "typescript": "~5.6.0"
  }
}
```
