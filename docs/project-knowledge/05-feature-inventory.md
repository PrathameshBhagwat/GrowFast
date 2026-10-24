# 05 — Feature-by-Feature Implementation Inventory

## 1. Overview & Evaluation Methodology

This feature inventory provides a comprehensive, auditable audit of all user-facing, administrative, and backend features across the GrowFast system.

### Status Definitions
- **Implemented and verified**: Full implementation present across UI, API, database, and shared contracts; verified by automated tests (Vitest/Jest) or physical execution.
- **Implemented but not fully verified**: Full implementation exists in code and passes TypeScript/build checks, but requires physical device hardware or runtime production integration (e.g., thermal printer, live SMS/WhatsApp provider).
- **Partially implemented**: Core functionality exists, but specific edge cases, sub-routes, or downstream flows remain in progress.
- **Broken or blocked**: Implementation has active blockers, syntax issues, or failing dependencies.
- **Planned**: Documented in roadmap/PRDs, but no working code exists.
- **Unknown**: Insufficient evidence to establish operational validity.

---

## 2. Comprehensive Feature Matrix

| # | Feature | Web Screen / Route | Mobile Screen / Component | Backend Module | API Endpoint / Operation | Database Model | Shared Package Dependency | Relevant Tests | Status | Evidence | Remaining Work |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Staff Authentication & PIN Login** | `/login` (`LoginPage.tsx`) | `app/(auth)/login.tsx` | `auth`, `employee` | `POST /auth/login` | `Employee`, `Store` | `LoginDto`, `AuthResponseDto`, `Role` | `auth.controller.spec.ts`, `mobile-auth.test.ts` | **Implemented and verified** | SHA-256 / bcrypt hash verification, JWT generation, SecureStore storage on mobile. | None. Verified in tests and physical Android launch. |
| **2** | **Employee Directory & Role Guard** | `/staff` (`StaffManagementPage.tsx`) | Directory picker on login | `employee` | `GET /employees`, `POST /employees` | `Employee` | `CreateEmployeeDto`, `Role` | `employee.service.spec.ts` | **Implemented and verified** | Staff listing filtered by `storeId` and `isActive: true`. Protected by `RolesGuard(['OWNER', 'MANAGER'])`. | UI pagination for large franchises (>100 staff). |
| **3** | **Customer Search & Registration** | `/` (`HomePage.tsx`) | `CustomerStep.tsx` | `customer` | `GET /customers/search`, `POST /customers` | `Customer` | `CustomerDto`, `CreateCustomerDto`, `MembershipTier` | `customer.service.spec.ts`, `order-wizard.test.ts` | **Implemented and verified** | Debounced search by phone or name. Instant registration modal for new walk-ins. | Auto-formatting international phone prefixes. |
| **4** | **Customer Profile & Ledger History** | `/customers/:id` (`CustomerProfilePage.tsx`) | `OrderDetailModal.tsx` | `customer`, `order` | `GET /customers/:id`, `GET /customers/:id/orders` | `Customer`, `Order` | `CustomerProfileDto` | `customer.controller.spec.ts` | **Implemented and verified** | Lifetime order history, total spent, outstanding balance, and customer preference notes. | Export customer statement to PDF. |
| **5** | **Garment Catalog & Category Management** | `/catalog` (`CatalogSettingsPage.tsx`) | `CatalogItemsStep.tsx` | `catalog` | `GET /catalog/garments`, `POST /catalog/garments` | `GarmentCatalog` | `GarmentCategory`, `GarmentCatalogDto` | `catalog.service.spec.ts` | **Implemented and verified** | Categories: `MEN`, `WOMEN`, `KIDS`, `HOUSEHOLD`, `SHOES`, `SPECIAL`, `WEIGHT_BASED`. | Bulk CSV garment import. |
| **6** | **Service Types & SLA Turnaround** | `/master-data` (`MasterDataPage.tsx`) | Category selector in wizard | `catalog` | `GET /catalog/services`, `POST /catalog/services` | `ServiceType` | `ServiceCategory`, `ServiceTypeDto` | `catalog.controller.spec.ts` | **Implemented and verified** | Configurable turnaround SLA days (default: 2 days) used for system due date calculation. | Per-garment SLA override (e.g., leather vs cotton). |
| **7** | **Matrix Pricing Engine (Service × Garment)** | `/catalog` (`CatalogSettingsPage.tsx`) | Price lookup in wizard | `catalog` | `GET /catalog/matrix`, `PUT /catalog/matrix` | `ServiceGarmentPrice` | `ServiceGarmentPriceDto` | `catalog.service.spec.ts` | **Implemented and verified** | Composite unique pricing `(garmentCatalogId, serviceTypeId, storeId)`. | Tiered volume discounts. |
| **8** | **5-Step Order Creation Wizard** | `/orders/new` (`OrderWizardPage.tsx`) | `OrderWizardModal.tsx` | `order` | `POST /orders` | `Order`, `OrderItem`, `PhysicalGarment` | `CreateOrderDto`, `OrderItemDto` | `order-wizard.test.ts`, `live-backend-e2e.test.ts` | **Implemented and verified** | Step 1: Customer, Step 2: Items, Step 3: Photos/Notes, Step 4: Options, Step 5: Review & Confirm. | Barcode scanner auto-selection of catalog items. |
| **9** | **Financial Pricing Engine & GST Rules** | Core shared engine | Wizard subtotal bar | `order` | Internal calculation | `Order` | `calculateOrderTotals()`, `PricingBreakdown` | `order.pricing.spec.ts` | **Implemented and verified** | Strict 18% GST, express multiplier (1.5x / 2.0x), minimum 2.0 kg weight threshold. | Custom tax exemptions. |
| **10** | **Physical Garment Tagging (`GF-XXXXXX`)** | `/orders/:id` (`OrderDetailPage.tsx`) | Order confirmation screen | `order` | `POST /orders/:id/generate-tags` | `PhysicalGarment`, `BusinessSequence` | `PhysicalGarmentDto` | `tag-system.spec.ts` | **Implemented and verified** | Sequential barcode/QR tag allocation; unique across all stores and orders. | Zebra thermal printer ESC/POS driver integration. |
| **11** | **Visual Thermal Tag Designer** | `/admin/tag-designer` (`TagDesignerPage.tsx`) | N/A (Web Admin only) | `store` | `GET /stores/:id/tag-template`, `PUT /stores/:id/tag-template` | `TagTemplate` | `TagTemplateDto` | `tag-designer.spec.ts` | **Implemented and verified** | Interactive drag-and-drop layout canvas for 40x40 mm thermal adhesive tags. | Native ESC/POS raw bytecode exporter. |
| **12** | **Garment Photo Capture & R2 Storage** | `/orders/:id/photos` (`PhotoCaptureView.tsx`) | `PhotoQueueView.tsx` | `photo` | `POST /photos/upload` | `OrderPhoto` | `PhotoType`, `OrderPhotoDto` | `photo.service.spec.ts` | **Implemented and verified** | Multi-angle photo capture (`FRONT`, `BACK`, `DAMAGE`, `STAIN`, `DELIVERY_PROOF`) via S3/R2 presigned URLs. | Offline client-side image compression before upload. |
| **13** | **Order Status & State Machine** | `/orders/:id` (`OrderDetailPage.tsx`) | `orders.tsx` | `order` | `PATCH /orders/:id/status` | `Order`, `OrderItem` | `deriveOrderStatus()`, `OrderStatus`, `ItemStatus` | `order-status.spec.ts` | **Implemented and verified** | Strict bottom-up status derivation. Order status is derived from items; never manually overwritten. | Automated SMS on status transition. |
| **14** | **Payment Collection & Ledger** | Payment modal on web | `PaymentCollectionModal.tsx` | `payment` | `POST /payments` | `Payment`, `Order` | `CreatePaymentDto`, `PaymentMode`, `PaymentStatus` | `payment.service.spec.ts`, `payment-workflow.test.ts` | **Implemented and verified** | Split/partial payments (`CASH`, `UPI`, `CARD`, `STORE_CREDIT`). Immediate balance recalculation. | Payment gateway webhook (Razorpay/PayTM). |
| **15** | **Payment Idempotency Protection** | N/A (Automated header) | `client.ts` UUID generator | `payment` | `POST /payments` (`Idempotency-Key`) | `Payment.idempotencyKey` | `PaymentResponseDto` | `payment-idempotency.spec.ts` | **Implemented and verified** | Duplicate submissions with identical `idempotencyKey` return existing transaction without double-charging. | Automated idempotency key rotation after failure. |
| **16** | **Financial Adjustments & Refunds** | `/orders/:id` | N/A | `payment` | `POST /payments/adjustments` | `FinancialAdjustment` | `AdjustmentType`, `AdjustmentStatus` | `payment.service.spec.ts` | **Implemented and verified** | Manager-approved credit notes and cash refunds with mandatory audit reason. | Customer wallet balance model. |
| **17** | **Home Delivery Logistics & Dispatch** | `/deliveries` (`DeliveryPage.tsx`) | Orders list filter | `delivery` | `GET /deliveries`, `PATCH /deliveries/:id` | `DeliveryRecord` | `DeliveryStatus`, `DeliveryRecordDto` | `delivery.service.spec.ts` | **Implemented and verified** | Rider assignment, scheduling, address dispatch, proof of delivery photo attachment. | GPS live rider tracking. |
| **18** | **WhatsApp Notification Engine** | Background event emitter | Background event emitter | `notification` | Internal Baileys service | `Notification` | `NotificationEventType`, `NotificationChannel` | `notification.service.spec.ts` | **Implemented but not fully verified** | Baileys multi-device socket integration, message template rendering, retry backoff. | Multi-session QR scanner in Owner portal. |
| **19** | **Real-Time Operational Dashboard** | `/dashboard` (`DashboardPage.tsx`) | `index.tsx` (Summary cards) | `dashboard` | `GET /dashboard/metrics` | `Order`, `Payment` | `DashboardMetricsDto` | `dashboard.service.spec.ts` | **Implemented and verified** | Today's revenue, pending orders, ready garments, deliveries due, and overdue alerts. | Custom date range datepicker. |
| **20** | **Daily Orders & Financial Report** | `/reports/daily-orders` (`DailyOrdersReportPage.tsx`) | N/A | `report` | `GET /reports/daily-orders` | `Order`, `Payment` | `DailyOrdersReportDto` | `report.service.spec.ts` | **Implemented and verified** | Filterable tabular order audit, payment reconciliations, cashier closing balances. | Excel/CSV download button. |
| **21** | **Mobile Offline Draft Staging** | N/A | `DraftEditorModal.tsx` | N/A (Client-only) | SQLite direct execution | SQLite: `order_drafts` | `CreateOrderDto` | `draft-sync.test.ts` | **Implemented and verified** | Offline order builder writes draft payload JSON into SQLite with unique `clientDraftId`. | Edit item quantity inside draft modal. |
| **22** | **Mobile Synchronization Engine** | N/A | `SyncManager.ts` | `order` | `POST /orders` (with `clientDraftId`) | `Order`, SQLite: `order_drafts` | `SyncStatus` | `draft-sync.test.ts`, `live-backend-e2e.test.ts` | **Implemented and verified** | Mutex-locked auto-sync with exponential backoff (`Math.min(1000 * 2^retries, 30000)`). SHA-256 validation. | Background sync when app is backgrounded. |
| **23** | **Network Status Banner & Recovery** | N/A | `ConnectionBanner.tsx` | N/A (Client-only) | NetInfo socket listener | N/A | N/A | `mobile-auth.test.ts` | **Implemented and verified** | Real-time visual offline indicator with automatic reconnect trigger and queue flush. | Ping healthcheck endpoint in addition to NetInfo. |

---

## 3. Critical Execution Trace: End-to-End Order Lifecycle

To illustrate the integration across all tiers, here is the verified execution trace for creating an order:

```
[Mobile / Web UI: Order Wizard]
   │
   ├─ Step 1: Search Customer (GET /customers/search?q=9876543210)
   ├─ Step 2: Select Items (Men Shirt - Dry Clean, 3 units @ ₹120)
   ├─ Step 3: Compute Totals locally via calculateOrderTotals() [₹360 + ₹64.80 GST = ₹424.80]
   ├─ Step 4: Staged to SQLite `order_drafts` (if offline) OR dispatched immediately via POST /orders
   │
[HTTP Request via axios / client.ts]
   │ Headers: Authorization: Bearer <JWT>, X-Store-Id: <storeId>
   ▼
[NestJS Backend: OrderController.createOrder()]
   │
   ├─ @UseGuards(JwtAuthGuard, RolesGuard)
   ├─ ValidationPipe verifies CreateOrderDto
   ├─ Idempotency Check: prisma.order.findUnique({ storeId_clientDraftId })
   │     └─ If already committed: return existing order immediately (200 OK)
   ├─ OrderService.create():
   │     ├─ Re-evaluates pricing server-side using active Store & Price matrix
   │     ├─ Computes systemDueDate (orderDate + estimatedDays, skips Thursdays)
   │     ├─ Generates sequential orderNumber (ORD-YYYYMMDD-XXXX)
   │     └─ DB Transaction ($transaction):
   │           ├─ INSERT INTO orders
   │           ├─ INSERT INTO order_items (3 units)
   │           ├─ INSERT INTO physical_garments (3 rows: units 1, 2, 3 with tags)
   │           └─ Emits EventEmitter: 'order.created'
   ▼
[NotificationService]
   │ Receives 'order.created'
   └─ Dispatches WhatsApp message via Baileys to customer's phone
   ▼
[HTTP Response: 201 Created]
   │ Returns canonical Order object with ID, orderNumber, and item details
   ▼
[Mobile Client: SyncManager]
   ├─ Updates SQLite `order_drafts`: sync_status = 'SYNCED', server_order_id = <id>
   └─ Triggers photo queue upload for associated item photos
```
