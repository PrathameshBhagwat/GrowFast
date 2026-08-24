# Business Rules

## Due-Date Calculation

- System calculates due date: `orderDate + max(service.estimatedDays for all items)`
- Express orders: estimated days halved (rounded up)
- Result stored in `systemDueDate`

## Due-Date Overrides

- Only **Owner** or **Manager** can override the due date
- Override requires a reason (free text)
- `effectiveDueDate` stores the actual due date used
- `dueDateOverrideReason` and `dueDateOverriddenBy` provide audit trail
- Original `systemDueDate` is preserved for reporting

## Express Service

- Express flag on order level
- Express surcharge applied (amount configurable per store)
- Processing priority elevated to EXPRESS
- Estimated delivery time reduced

## Partial Delivery

- Individual items can be delivered before the full order is complete
- `deliveredQuantity` on OrderItem tracks how many units have been handed over
- Order status derived from item statuses — remains READY until all items delivered
- Payment can be collected on partial deliveries

## Payment Status

- **PENDING**: No payment received (amountPaid = 0)
- **PARTIAL**: Some payment received (0 < amountPaid < totalAmount)
- **PAID**: Full payment received (amountPaid >= totalAmount)
- **REFUNDED**: Payment reversed (edge case, future)
- Payment status is automatically updated when payments are recorded

## Photo Proof

- Intake photos: Captured at counter during order creation
- Types: FRONT, BACK, DAMAGE, STAIN, TAG
- Delivery proof: DELIVERY_PROOF type captured by rider
- Photos linked to specific OrderItem when possible
- Cloud upload deferred to implementation phase

## Order Status Derivation

- **Single source of truth**: `deriveOrderStatus()` in `@growfast/shared-types`
- Order status is NEVER manually set — always derived from item statuses
- Delivery module must call this function, not set status directly
- See `packages/shared-types/src/order-status.ts` for rules

## Role Restrictions

| Action            | Owner | Manager | Counter | Delivery  |
| ----------------- | ----- | ------- | ------- | --------- |
| Create order      | ✅    | ✅      | ✅      | ❌        |
| View orders       | ✅    | ✅      | ✅      | Own tasks |
| Override due date | ✅    | ✅      | ❌      | ❌        |
| Record payment    | ✅    | ✅      | ✅      | ✅ (COD)  |
| Manage employees  | ✅    | ❌      | ❌      | ❌        |
| View analytics    | ✅    | ✅      | ❌      | ❌        |
| Update pricing    | ✅    | ❌      | ❌      | ❌        |
| Manage deliveries | ✅    | ✅      | ❌      | ✅        |

## Rules NOT Invented

The following areas have ambiguity in the requirements and need clarification:

1. Automatic discount application based on membership tier
2. Tax/GST calculation rules
3. Late delivery penalty or notification rules
4. Customer credit/refund workflow
5. Weight-based pricing calculation formula
