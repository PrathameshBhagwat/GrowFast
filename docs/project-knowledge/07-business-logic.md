# 07 — Business Logic & Domain Rule Engine

## 1. Overview & Architecture

The GrowFast system enforces a strict "Single Source of Truth" architectural principle:

- **Shared Business Contracts**: All pricing formulas, order status state machines, category compatibility matrices, and SLA holiday rules are centralized in `packages/shared-types`.
- **Zero Redefinition Rule**: Neither frontend (`apps/web`), mobile (`apps/mobile`), nor backend (`apps/backend`) is permitted to duplicate or manually override these algorithms (Rule 14 & Rule 16 in `AGENTS.md`).
- **Server Authority**: While client applications compute optimistic pricing previews for UX responsiveness, the backend executes an identical server-side recalculation within an atomic database transaction prior to committing records.

---

## 2. Order Status State Machine (`deriveOrderStatus`)

Source: `packages/shared-types/src/order-status.ts`

### 2.1 Core Invariant

**Order status is NEVER set directly by any API call or database mutation.** Instead, order status is a pure derived property computed deterministically from the discrete statuses of all non-cancelled items in the order.

### 2.2 Item Progression Hierarchy

The system defines a linear progress index for garment items:

```typescript
const ITEM_PROGRESSION = [
  ItemStatus.RECEIVED, // Index 0: Order accepted at counter
  ItemStatus.PROCESSING, // Index 1: Washing / dry cleaning in progress
  ItemStatus.QUALITY_CHECK, // Index 2: Post-wash inspection & ironing
  ItemStatus.READY, // Index 3: Tagged, bagged, and ready for pickup
  ItemStatus.DELIVERED, // Index 4: Handed over to customer or rider
];
```

### 2.3 Derivation Algorithm

```typescript
export function deriveOrderStatus(ctx: OrderStatusDerivationContext): OrderStatus;
```

1. **Empty Order**: If `items.length === 0`, return `OrderStatus.RECEIVED`.
2. **All Cancelled**: Filter out `ItemStatus.CANCELLED`. If `nonCancelled.length === 0`, return `OrderStatus.CANCELLED`.
3. **Lowest Common Denominator Rule**: Find the minimum progression index among all non-cancelled items:
   - If ALL items are `DELIVERED` → `OrderStatus.DELIVERED`.
   - If `hasActiveTransitDelivery` is true and items are `READY` or higher → `OrderStatus.OUT_FOR_DELIVERY`.
   - If lowest item is `READY`:
     - If `currentOrderStatus === OrderStatus.PACKED` → preserve `PACKED`.
     - Otherwise → `OrderStatus.READY`.
   - If lowest item is `PROCESSING`:
     - If current status is granular (`SORTING`, `DRYING`, `IRONING`) → preserve granular operational phase.
     - Otherwise → `OrderStatus.PROCESSING`.
   - If lowest item is `QUALITY_CHECK` → `OrderStatus.QUALITY_CHECK`.
   - If lowest item is `RECEIVED` → `OrderStatus.RECEIVED`.

---

## 3. Financial Calculation & Pricing Engine

Source: `packages/shared-types/src/pricing.ts`

### 3.1 Order Total Pipeline

```
Subtotal (Σ line_items)
   │
   ├─ [ - Discount Amount (forced to 0% in V1) ]
   │
   ▼
Discounted Subtotal
   │
   ├─ [ + Express Surcharge (Base Express × Multiplier) ]
   │
   ▼
Taxable Amount (Discounted Subtotal + Express Surcharge)
   │
   ├─ [ + 18% GST (Taxable Amount × 0.18) ]
   │
   ▼
Total Order Amount (rounded half-up)
```

### 3.2 Canonical Formulas & Code Implementation

#### 1. Line Item Subtotal

For weight-based laundry:
$$\text{LineTotal} = \text{roundCurrency}(\text{unitPrice} \times \text{weight})$$
For piece-based dry cleaning:
$$\text{LineTotal} = \text{roundCurrency}(\text{unitPrice} \times \text{quantity})$$

#### 2. Half-Up Currency Rounding

Corrects IEEE 754 64-bit binary floating-point representation errors:

```typescript
export function roundCurrency(val: number): number {
  return Math.round((val + 1e-9) * 100) / 100;
}
```

#### 3. Express Surcharge Multipliers

Source: `getExpressMultiplier(option)`

- **Same-Day Delivery**: `2.0×` the store's configured express rate.
- **Next-Day Evening Delivery**: `1.5×` the store's configured express rate.
- **Regular Delivery**: `0×` (No surcharge applied).

$$\text{BaseSurcharge} = \text{roundCurrency}\left(\frac{\text{DiscountedSubtotal} \times \text{StoreExpressPercent}}{100}\right)$$
$$\text{ExpressSurcharge} = \text{roundCurrency}(\text{BaseSurcharge} \times \text{Multiplier})$$

#### 4. Tax (18% GST)

Under Indian tax compliance rules for laundry services, GST is charged at **18%** and is assessed on the entire service fee including express delivery additions:
$$\text{TaxableAmount} = \text{roundCurrency}(\text{DiscountedSubtotal} + \text{ExpressSurcharge})$$
$$\text{TaxAmount} = \text{roundCurrency}(\text{TaxableAmount} \times 0.18)$$
$$\text{TotalAmount} = \text{roundCurrency}(\text{TaxableAmount} + \text{TaxAmount})$$

---

## 4. Partial Pickup & Fulfillment Financial Breakdown

Source: `calculateFulfillmentBreakdown()` in `packages/shared-types/src/pricing.ts`

When a customer picks up a portion of their order (e.g. 2 shirts ready out of 5), the cashier cannot blindly charge the full order total or allow free release. The engine apportions the bill dynamically:

$$\text{ReadyLine} = \sum_{\text{READY}} \text{lineTotal}$$
$$\text{CollectedLine} = \sum_{\text{DELIVERED}} \text{lineTotal}$$
$$\text{TotalLine} = \sum \text{lineTotal}$$
$$\text{ReadyAmount} = \text{roundCurrency}\left(\frac{\text{ReadyLine}}{\text{TotalLine}} \times \text{TotalAmount}\right)$$
$$\text{CollectedAmount} = \text{roundCurrency}\left(\frac{\text{CollectedLine}}{\text{TotalLine}} \times \text{TotalAmount}\right)$$
$$\text{PayableAmount} = \max(0, \text{ReadyAmount} + \text{CollectedAmount} - \text{AmountPaid})$$

---

## 5. Workflow & Catalog Compatibility Rules

Source: `packages/shared-types/src/catalog.ts`

GrowFast operates two distinct business workflows with strict separation:

| Rule                     | `LAUNDRY` Workflow                                                        | `DRY_CLEANING` Workflow                            |
| :----------------------- | :------------------------------------------------------------------------ | :------------------------------------------------- |
| **Primary Unit**         | Weight (kg) or Batch pieces                                               | Strictly Per-Piece with individual tags            |
| **Minimum Weight**       | Minimum **2.00 kg** threshold for weight-based washing                    | N/A (Weight mode strictly disallowed)              |
| **Allowed Services**     | Wash & Steam Iron, Wash & Fold, Standard Wash, Premium Laundry, Starching | Dry Clean, Steam Iron, Starching, Shoe Cleaning    |
| **Excluded Services**    | Dry Clean strictly disallowed                                             | Wash & Fold, Wash & Steam Iron strictly disallowed |
| **Global Exclusions**    | "Free Shoe" and "Reprocess Cleaning" hidden from all operator menus       | Same                                               |
| **Starching Limitation** | Allowed ONLY for: `MEN`, `WOMEN`, `KIDS`                                  | Same                                               |
| **Shoe Category**        | Hides: Steam Iron, Wash + Steam Iron, Starching                           | Same                                               |

---

## 6. SLA Turnaround & Holiday Calendar Rules

Source: `adjustDueDateForThursday()` in `packages/shared-types/src/catalog.ts`

- **Standard SLA Turnaround**: Derived from `ServiceType.estimatedDays` (default: 2 calendar days from order placement).
- **Weekly Off Day Rule**: Laundry operations in this market traditionally close on **Thursdays**.
  - If the initial calculated completion date falls on a **Thursday** in the `Asia/Kolkata` timezone (Day index 4), the engine automatically advances the `effectiveDueDate` to **Friday (+1 calendar day)**.
  - Manual overrides by `OWNER` or `MANAGER` are permitted via `PATCH /api/orders/:id/due-date`, but require an explicit `reason` logged in the audit ledger.

---

## 7. Tag Generation & Idempotent Numbering

- **Order Number Format**: `ORD-YYYYMMDD-XXXX` sequentially generated via `BusinessSequence` ("order_number_seq").
- **Garment Tag Format**: `GF-XXXXXX` (e.g. `GF-001042`).
  - Allocated in the database transaction upon order submission.
  - Every physical unit (e.g. 3 trousers in 1 line item) receives an isolated `PhysicalGarment` row with its own unique `tagId`.
- **Client Idempotency**:
  - Mobile client generates a random UUID (`clientDraftId`).
  - Server enforces composite unique constraint: `@@unique([storeId, clientDraftId])`.
  - If network disconnects after DB commit, client retry submits identical `clientDraftId`. Server detects record, skips insertion, and returns existing 200 OK.
