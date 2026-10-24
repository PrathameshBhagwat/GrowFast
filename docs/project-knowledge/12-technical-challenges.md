# 12 — Technical Challenges & Engineering Solutions

## 1. Overview

Building a high-throughput, multi-platform laundry management system across web, mobile POS, and a relational backend revealed several non-trivial architectural and systems-engineering challenges. This document details the technical root causes, evaluated alternatives, chosen solutions, and verified outcomes for the six most critical challenges encountered in the repository.

---

## 2. Deep Dive: Top 6 Engineering Challenges

### Challenge 1: Dual React Version Coexistence in Monorepo (React 19 vs React 18)

- **Problem**: The web portal (`apps/web`) leverages **React 19.2.8** and Vite 6 for cutting-edge web performance and Tailwind CSS v4 compatibility. However, **Expo SDK 52** and **React Native 0.76.9** strictly require **React 18.3.1**. Standard npm workspace hoisting attempted to hoist React 19 to the repository root, which caused React Native native module resolution to crash at runtime with missing symbol errors (`useHostRef`, incompatible dispatcher internals).
- **Root Cause**: npm workspaces share a single root `node_modules` by default, hoisting the highest semantic version of duplicate packages unless explicitly prevented.
- **Evaluated Alternatives**:
  1. _Downgrade Web to React 18_: Rejected because it sacrificed web design-system features and modern React 19 actions.
  2. _Split into Separate Repositories_: Rejected because it broke the requirement for shared TypeScript types (`@growfast/shared-types`) and unified git history.
- **Chosen Solution**: Configured isolated dependency boundaries. Pinned `react@18.3.1` in `apps/mobile/package.json` and customized Metro (`apps/mobile/metro.config.js`) using `getDefaultConfig(__dirname)` with explicit module resolution pinning:
  ```javascript
  config.resolver.extraNodeModules = {
    react: path.resolve(__dirname, 'node_modules/react'),
    'react-native': path.resolve(__dirname, 'node_modules/react-native'),
  };
  ```
- **Trade-offs**: Requires running mobile scripts from the mobile workspace context; slight disk footprint increase from dual node_modules folders.
- **Verification Evidence**: Both `npm run build:web` (React 19) and `npx expo export` (React 18) compile cleanly with 0 TypeScript errors.

---

### Challenge 2: Expo Router Bundling Failure (`EXPO_ROUTER_APP_ROOT`)

- **Problem**: When booting the mobile POS app via Expo Go on physical Android devices, Metro crashed with an HTTP 500 error:
  `expo-router/_ctx.android.js: Invalid call at line 2: process.env.EXPO_ROUTER_APP_ROOT`
  `First argument of require.context should be a string denoting the directory to require.`
- **Root Cause**: Metro was configured to resolve files from the repository root, but Expo Router relies on Babel macro evaluation at compile-time to replace `process.env.EXPO_ROUTER_APP_ROOT` with the string literal path of the route folder relative to the project root.
- **Chosen Solution**:
  1. Configured `apps/mobile/package.json` with explicit entry point `"main": "expo-router/entry"`.
  2. Updated `apps/mobile/babel.config.js` to ensure `babel-preset-expo` is applied with router plugin enablement.
  3. Configured Metro watch folders to selectively encompass `packages/shared-types` while keeping the project root isolated to `apps/mobile`.
- **Verification Evidence**: Metro bundles `apps/mobile/node_modules/expo-router/entry.js` and delivers the bundle to Android within 1,200 ms with 200 OK.

---

### Challenge 3: Physical Android LAN Connectivity & Cross-Origin Loopback

- **Problem**: Metro ran on `http://192.168.1.38:8081` and loaded the mobile UI on a physical Android smartphone. However, all API requests failed with:
  `WARN Could not load employee directory: Network request failed`
- **Root Cause**: Two contributing factors:
  1. The mobile API client defaulted to `http://localhost:3000/api`. On physical Android, `localhost` resolves to the phone's internal loopback interface (`127.0.0.1`), not the developer workstation.
  2. The NestJS backend bootstrap in `apps/backend/src/main.ts` executed `await app.listen(3000)` without specifying a host address, causing Node.js to bind strictly to IPv4 loopback `127.0.0.1` and rejecting external LAN packets from Wi-Fi clients.
- **Chosen Solution**:
  1. Updated `main.ts` to bind explicitly to all network interfaces:
     ```typescript
     await app.listen(port, '0.0.0.0');
     ```
  2. Configured `apps/mobile/.env` with LAN IP routing:
     ```
     EXPO_PUBLIC_API_URL=http://192.168.1.38:3000/api
     ```
  3. Configured NestJS CORS to accept requests from dynamic mobile LAN origins.
- **Verification Evidence**: Physical phone successfully fetches employee directory, submits login PIN, and retrieves order history over local Wi-Fi.

---

### Challenge 4: Two-Phase Timeout-After-Commit Recovery in Sync Engine

- **Problem**: In unstable cellular or edge Wi-Fi conditions, a mobile POS device submitting an offline order draft (`POST /orders`) frequently timed out after 15 seconds. If the backend had already committed the database transaction, a subsequent automatic retry would attempt to re-insert the draft and fail with a 409 Conflict, leaving the mobile client stuck in `FAILED` state while an orphaned order existed in PostgreSQL.
- **Root Cause**: HTTP socket timeouts are client-side decisions; network drops can occur after the server commits the database transaction but before the response packet reaches the mobile antenna.
- **Chosen Solution**: Developed a **Two-Phase Idempotency Probe**:
  1. Mobile client stamps every draft with a permanent UUID `clientDraftId`.
  2. PostgreSQL enforces composite uniqueness: `@@unique([storeId, clientDraftId])`.
  3. The `SyncEngine` executes a **Pre-Check Probe** (`GET /orders/by-draft/:draftId`). If the order exists, it captures the server order ID and bypasses `POST /orders`.
  4. If `POST /orders` fails due to a network timeout, the engine immediately executes a **Post-Timeout Rescue Probe** to the same endpoint. If the server acknowledges the record, the draft transitions to `SYNCED` with `recovered: true`.
- **Verification Evidence**: Automated in `apps/mobile/src/__tests__/live-backend-e2e.test.ts` and `apps/backend/src/order/order-idempotency.spec.ts`.

---

### Challenge 5: Canonical Order Status Derivation vs Distributed State Drift

- **Problem**: With multiple developers working in parallel, the delivery module began manually setting `order.status = DELIVERED`, while the payment module set `order.status = READY`, leading to invalid operational states (e.g. an order marked `DELIVERED` when 2 of 5 garments were still in `PROCESSING`).
- **Root Cause**: Distributed write authority on a central entity status without a single deterministic state machine.
- **Chosen Solution**:
  1. Enforced Rule 16 in `AGENTS.md`: Canonical derivation using `deriveOrderStatus()` from `@growfast/shared-types`.
  2. Removed all direct write operations on `Order.status` across all backend modules.
  3. Order status is derived bottom-up: individual physical garments progress through item-level statuses (`RECEIVED` -> `PROCESSING` -> `QUALITY_CHECK` -> `READY` -> `DELIVERED`). Whenever an item changes, `deriveOrderStatus()` recalculates the macro order state.
- **Verification Evidence**: 18 unit tests in `packages/shared-types/src/catalog.spec.ts` proving zero status anomalies across all combinations of partial item fulfillment.

---

### Challenge 6: Payment Duplicate Protection & Concurrency Races

- **Problem**: Cashiers rapidly tapping "Collect Payment" on touchscreen terminals caused duplicate HTTP requests, creating duplicate payment rows in the database and corrupting customer credit balances.
- **Root Cause**: Non-atomic client click handlers coupled with absence of database-level idempotency enforcement on the `payments` table.
- **Chosen Solution**:
  1. Added unique `idempotencyKey` field to the Prisma `Payment` model (`@unique @map("idempotency_key")`).
  2. Wrapped payment creation in an atomic Prisma transaction (`prisma.$transaction`).
  3. If a submission arrives with an existing `idempotencyKey`, the backend returns the existing `Payment` record with 200 OK instead of throwing a 500 error or inserting a duplicate charge.
- **Verification Evidence**: Verified via `apps/backend/src/payment/payment-idempotency.spec.ts` with parallel concurrent request execution.
