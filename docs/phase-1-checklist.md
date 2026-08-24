# Phase 1 Implementation Checklist

## FOUNDATION & GOVERNANCE

- [x] Phase 0 verified (Typecheck, Builds, Tests, Linting pass)
- [x] Git checkpoint created (`phase-0-complete` tag)
- [x] Main branch clean and deployable
- [x] CI workflow configured and passing
- [x] Three developer ownership areas documented
- [x] Git workflow and PR templates configured

---

## DEVELOPER A (Auth / Employee / Customer)

- [ ] **A1:** Customer search by phone / name API & UI
- [ ] **A2:** Customer create form with duplicate phone validation
- [ ] **A3:** Customer profile view with tier & discount display
- [ ] **A4:** Customer detail editing & preference management (starch, fragrance, fold)
- [ ] **A5:** Customer order history view
- [ ] **A6:** Employee management & PIN assignment (Owner only)

---

## DEVELOPER B (Catalog / Order)

- [ ] **B1:** Garment catalog management & categories
- [ ] **B2:** Service type management & turnaround times
- [ ] **B3:** Multi-step Order Creation Wizard
- [ ] **B4:** Order items list, tagging, & defect notes
- [ ] **B5:** Pricing calculations (subtotal, discounts, totals)
- [ ] **B6:** Due-date calculation & Manager override audit trail
- [ ] **B7:** Express service flag & express surcharge
- [ ] **B8:** Canonical `deriveOrderStatus()` integration

---

## DEVELOPER C (Photo / Delivery / Payment / Notification / Dashboard)

- [ ] **C1:** Photo storage infrastructure service
- [ ] **C2:** Photo upload endpoint & order photo gallery
- [ ] **C3:** Payment recording (Cash, UPI, Card)
- [ ] **C4:** Payment status auto-transition (`PENDING` → `PARTIAL` → `PAID`)
- [ ] **C5:** Delivery dispatch task list & status tracking
- [ ] **C6:** Partial delivery reconciliation & proof of delivery photo
- [ ] **C7:** Management KPI dashboard
- [ ] **C8:** Notification event hooks foundation

---

## INTEGRATION & END-TO-END

- [ ] **Seam 1:** Customer selection in Customer Details passes to Order Wizard
- [ ] **Seam 2:** Order Wizard captures photo via `PhotoCapture` and saves via Photo API
- [ ] **Seam 3:** Delivery marks item delivered → triggers `deriveOrderStatus()`
- [ ] **Seam 4:** Payment updates balance without affecting processing status
- [ ] Full business intake-to-delivery lifecycle test
- [ ] Partial delivery workflow test
- [ ] Role authorization tests across all endpoints
