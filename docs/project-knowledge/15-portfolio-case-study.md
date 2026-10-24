# 15 — Engineering Portfolio Case Study: GrowFast ERP & Mobile POS

## 1. Executive Summary & Project Metadata

- **Project**: GrowFast Laundry & Dry-Cleaning Management System
- **Domain**: Commercial Retail ERP, Logistics, and Offline-First Mobile Point of Sale (POS)
- **Role**: Full-Stack Software Architect & Lead Mobile Systems Engineer
- **Timeline**: Multi-phase iterative development across an engineering team of three
- **Core Stack**: NestJS 10, React 19, React Native 0.76.9, Expo SDK 52, Prisma ORM 5, PostgreSQL 16, SQLite, Cloudflare R2, Baileys WhatsApp

---

## 2. The Business Problem

Commercial laundry and dry-cleaning businesses operate in high-pressure physical environments that present distinct operational challenges:

1. **Garment Misplacement & Disputed Damage**: Hundreds of identical white shirts pass through shared industrial washers daily. Without individual garment tagging and condition photos at intake, customer disputes regarding lost clothes or pre-existing stains are common and costly.
2. **Volatile Network Connectivity**: Retail store counters and delivery vans operating in suburban or basement facilities frequently lose internet access. Traditional cloud-only POS systems freeze, halting customer intake and causing checkout bottlenecks.
3. **Complex Domain Workflows**: The laundry business is split into two conflicting workflows:
   - _Laundry_: Bulk washing charged by weight (kg) with a mandatory minimum threshold (e.g. 2.00 kg).
   - _Dry Cleaning_: Delicate garments charged strictly per-piece with specialized chemical treatments and individual thermal tags.
4. **Multi-Rate Taxation & Express Surcharges**: Pricing must incorporate tiered express turnaround multipliers (Same-Day 2.0×, Next-Day 1.5×), 18% statutory GST, and partial fulfillment settlements when customers pick up only a fraction of their order.

---

## 3. System Architecture & Topology

GrowFast was designed as a distributed, multi-platform system unified by shared business contracts:

```
[ Customer / Counter Terminal ]          [ Driver / Delivery Van ]
       │                                         │
       ▼                                         ▼
 React 19 Web App (Vite 6)             Expo SDK 52 Mobile POS (RN 0.76)
 (Desktop Touch POS & Admin)           (Offline-First SQLite Staging)
       │                                         │
       └─────────────────┬───────────────────────┘
                         │ REST over HTTP/1.1 (JSON + Bearer JWT)
                         ▼
             [ NestJS 10 Backend API ]
             ├── Global ValidationPipe & Throttler
             ├── JWT & RolesGuard (RBAC)
             ├── Pricing & Status Engines (@growfast/shared-types)
             └── Storage & Notification Providers
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
[ PostgreSQL 16 ]  [ Cloudflare R2 ]  [ WhatsApp Socket ]
(Prisma ORM 5)     (S3 Photo CDN)     (Baileys Multi-Device)
```

---

## 4. Key Architectural Decisions & Engineering Solutions

### 4.1 Zero-Duplication Shared Contracts (`@growfast/shared-types`)

To prevent logic drift between frontend and backend, all financial formulas, state machines, and DTOs were isolated into a zero-dependency pure TypeScript workspace package.

- **Outcome**: The mobile client calculates an instant offline price preview using the exact same code the backend executes to compute the authoritative invoice.

### 4.2 Offline-First Staging & Idempotency Recovery

Rather than making network requests blocking in the UI, the mobile app commits orders immediately to a local SQLite database (`order_drafts`) stamped with a client UUID (`clientDraftId`).

- **Two-Phase Idempotency Recovery**: If a network timeout occurs during order creation, the background `SyncEngine` probes `GET /orders/by-draft/:draftId` before declaring failure. If PostgreSQL committed the record before the cellular drop, the engine recovers the server order ID without creating a duplicate.

### 4.3 Deterministic Bottom-Up Status State Machine

To eliminate race conditions between counter, processing, and delivery staff, `Order.status` is never mutated directly. It is computed as a pure function (`deriveOrderStatus`) based on the lowest common progression index among non-cancelled items.

### 4.4 Coexistence of React 19 and React 18 in Monorepo

Solved an unresolvable npm dependency conflict where React Native crashed on React 19 by customizing Metro resolver aliases (`extraNodeModules`), allowing the web app to utilize React 19 while keeping native compilation strictly on React 18.3.1.

---

## 5. Verification, Quality Gates & Live Hardware Results

| Tier                  | Tooling                  | Scope                                                                 | Result             |
| :-------------------- | :----------------------- | :-------------------------------------------------------------------- | :----------------- |
| **Shared Contracts**  | Vitest 4.1               | 18% GST, express multipliers, IEEE 754 rounding, Thursday off rules   | 32 tests passing   |
| **Backend Services**  | Jest 29.7                | Idempotency, PIN bcrypt, tag allocation, payments, R2 photo streaming | 300+ tests passing |
| **Mobile Client**     | Jest 29.7                | SQLite staging, backoff with jitter, TanStack cache invalidation      | 65 tests passing   |
| **Monorepo Build**    | TypeScript / Vite / Nest | Complete compilation across all 5 workspaces                          | 0 errors           |
| **Physical Hardware** | Android 14 Smartphone    | Expo Go over LAN (`192.168.1.38`), PIN login, order staging           | Verified live      |

---

## 6. Known Limitations & Future Roadmap

1. **Hardware Thermal Printing**: Tag layout canvas is complete; live ESC/POS byte streaming to a physical Zebra/Epson printer remains unverified due to lack of physical hardware.
2. **Payment Gateway Integration**: Multi-mode cash/UPI tender ledger is complete; integration with hosted checkout webhooks (Razorpay/Stripe) is planned for Phase G.
3. **Multi-Store Inter-Branch Routing**: Garments currently process within the intake store; central processing plant hub-and-spoke transfer is planned for enterprise scaling.

---

## 7. Key Lessons Learned

- **Decouple Business Logic Early**: Putting core formulas in `@growfast/shared-types` saved dozens of hours when synchronizing mobile offline logic with backend validation.
- **Network Timeouts Are Not Failures**: In mobile edge computing, a timeout frequently means the server succeeded but the client lost reception. Designing for idempotent recovery is mandatory.
- **Monorepo Version Isolation**: Hoisting works well until mobile native frameworks lag behind web React releases; explicit bundler path overrides are essential for hybrid monorepos.
