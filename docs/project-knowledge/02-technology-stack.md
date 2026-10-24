# 02. Technology Stack & Architectural Rationale

> **Module:** Technology Inventory, Versions, Responsibilities & Trade-offs  
> **Source Location:** Root `package.json`, `apps/*/package.json`, `packages/*/package.json`  
> **Status:** Verified Against Actual Installed Dependencies  

---

## 1. Monorepo & Tooling Overview

GrowFast is architected as an **npm workspaces monorepo**. This structure allows packages and applications to share contracts, types, and business logic while isolating runtime environments that have differing native or framework constraints.

```
├── Root package.json (npm workspaces, scripts, prisma devDependencies)
├── apps/
│   ├── backend/package.json    (Node.js 20+, NestJS 10, Prisma 5 Client)
│   ├── web/package.json        (React 19, Vite 6, Tailwind CSS v4)
│   └── mobile/package.json     (React 18, React Native 0.76.9, Expo SDK 52)
└── packages/
    ├── shared-types/package.json (Pure TypeScript contracts, zero runtime deps)
    └── ui/package.json           (React 19 Web component library)
```

---

## 2. Comprehensive Technology Matrix

### A. Backend (`apps/backend`)

| Technology | Verified Version | Responsibility | Architectural Rationale & Why Used |
|---|---|---|---|
| **NestJS** | `^10.4.0` | Server framework & micro-monolith | Provides enterprise-grade dependency injection, modular boundaries, declarative interceptors, and strict separation between HTTP controllers and business logic services. |
| **Prisma ORM** | `^5.20.0` | Database abstraction & query engine | Type-safe SQL query generation, automatic migration generation from `schema.prisma`, relational integrity checks, and composite uniqueness constraints. |
| **PostgreSQL** | `16` (via Docker) | Primary relational database | ACID transactions for financial settlements, foreign key cascading, JSONB columns for flexible preference/tag layouts, and strong indexing support. |
| **Passport & JWT** | `@nestjs/jwt ^10.2.0`, `passport-jwt ^4.0.1` | Stateless authentication | Generates cryptographically signed access tokens carrying employee claims (`sub`, `role`, `storeId`, `name`). Validated on every protected endpoint without database lookups. |
| **bcryptjs** | `^2.4.3` | PIN credential hashing | One-way hashing with 10 salt rounds to protect staff PINs (`111111`, `333333`, etc.) in the database, preventing plaintext exposure. |
| **class-validator / class-transformer** | `^0.14.1` / `^0.5.1` | Inbound payload validation | Automatic sanitization and type enforcement via NestJS global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`. |
| **@nestjs/throttler** | `^6.5.0` | Rate limiting | Protects sensitive authentication endpoints (`POST /api/auth/login`) against brute-force dictionary attacks. |
| **AWS SDK v3 (S3 Client)** | `^3.1127.0` | Cloud photo storage | S3-compatible API used to upload garment defect and delivery proof photos directly to **Cloudflare R2** with zero egress fees. |
| **@whiskeysockets/baileys** | `^7.0.0-rc14` | WhatsApp messaging | Direct WebSocket integration with WhatsApp Multi-Device protocol, enabling automated transactional receipt delivery without expensive third-party SMS gateway fees. |
| **Pino** | `^10.3.1` | Structured JSON logging | High-speed, non-blocking asynchronous logger providing structured logs for tracing requests and security events. |

---

### B. Mobile POS & Rider Application (`apps/mobile`)

| Technology | Verified Version | Responsibility | Architectural Rationale & Why Used |
|---|---|---|---|
| **React Native** | `0.76.9` | Native UI runtime | Compiles to native Android views, enabling high-performance touch response, offline database access, and direct hardware camera integration. |
| **Expo SDK** | `~52.0.0` (52.0.49) | Mobile runtime platform & tooling | Standardized native module ecosystem, robust Android development server (Metro), and smooth native builds. |
| **Expo Router** | `~4.0.0` | File-based routing | File-system-based navigation matching Next.js conventions (`app/(auth)/login.tsx`, `app/(tabs)/orders.tsx`), deep linking, and protected route wrappers. |
| **Expo SQLite** | `~15.1.4` | Local offline database | Runs embedded SQLite inside the mobile app to persist drafts (`order_drafts`) and photos (`pending_photos`) when operating without cellular/Wi-Fi connection. |
| **Expo SecureStore** | `~14.0.0` | Hardware-backed keystore | Encrypts JWT auth tokens and user sessions using Android KeyStore, surviving app relaunches without plaintext storage. |
| **TanStack React Query** | `^5.60.0` | Server-state management | Asynchronous query caching, automatic retries, background invalidation, and UI optimistic updates. |
| **NetInfo** | `11.4.1` | Network state listener | Monitors device connectivity (`isConnected`, `isInternetReachable`) to trigger automatic synchronization when reconnecting. |
| **React Hook Form** | `^7.53.0` | Performant form state | Manages multi-step order intake inputs with zero unnecessary re-renders. |
| **Expo Image Picker** | `~16.0.6` | Camera & defect photo capture | Direct device camera access to take garment photos at intake, saving JPEG files into app-private sandboxed storage. |

---

### C. Web Management Portal (`apps/web`)

| Technology | Verified Version | Responsibility | Architectural Rationale & Why Used |
|---|---|---|---|
| **React** | `^19.2.8` | Component rendering engine | Leverages the latest React 19 concurrent features, Actions, and optimized DOM rendering for high-density administrative tables and dashboards. |
| **Vite** | `^6.0.0` | Build tool & dev server | Ultra-fast Hot Module Replacement (HMR) and optimized Rollup-based production bundling. |
| **Tailwind CSS** | `^4.0.0` | Utility-first styling | Zero-runtime CSS generation, modern CSS variables, fluid responsive layouts, and dark-mode capable color tokens. |
| **React Router DOM** | `^7.1.0` | Client-side routing | Handles route definitions, browser history, navigation guards, and query-parameter synchronization for order filters. |
| **Lucide React** | `^1.33.0` | Iconography | High-quality, tree-shakable SVG icon set used across all portal navigation and status indicators. |
| **Vitest** | `^4.1.11` | Unit & component testing | Native Vite test runner executing component unit tests with jsdom environment. |
| **Playwright** | `^1.62.1` | End-to-end browser testing | Automated headless browser validation of complete user workflows across desktop and mobile viewports. |

---

### D. Shared Packages (`packages/`)

| Package | Contents | Consumers | Key Responsibilities |
|---|---|---|---|
| **`@growfast/shared-types`** | Pure TypeScript enums, DTOs, and pure calculation functions | `apps/backend`, `apps/web`, `apps/mobile`, `packages/ui` | Single source of truth for `Role`, `OrderStatus`, `ItemStatus`, `PaymentMode`, `deriveOrderStatus()`, and `calculateOrderTotals()`. Zero external dependencies. |
| **`@growfast/ui`** | Reusable React 19 UI components (`Button`, `Card`, `StatusChip`, `PhotoCapture`) | `apps/web` | Ensures visual consistency, design tokens, and shared component markup across all web pages. |

---

## 3. Major Architectural Trade-Offs & Decisions

### 1. Dual React Versions: React 19 (Web) vs. React 18 (Mobile)
- **The Challenge**: React 19 was adopted for the Web portal to take advantage of React 19 and Vite 6 features. However, React Native 0.76.9 / Expo SDK 52 requires React 18.3.1. In npm workspaces, dependencies hoist to the root by default, causing version conflicts.
- **The Solution**: 
  - Mobile maintains its own localized `node_modules/react` (`18.3.1`) and `node_modules/react-native` (`0.76.9`).
  - `apps/mobile/metro.config.js` configures `resolver.extraNodeModules` and sets `resolver.disableHierarchicalLookup = true`, forcing Metro to resolve React 18 from the mobile workspace.
  - `@growfast/ui` is strictly scoped to Web (`peerDependencies: react ^19.0.0`), preventing invalid imports into React Native.

### 2. Micro-Monolith vs. Microservices
- **The Decision**: NestJS is implemented as a modular micro-monolith within `apps/backend` rather than multi-repo microservices.
- **Why It Fits**: The system coordinates 15 distinct functional domains (auth, orders, payments, photos, notifications). A modular monolith eliminates network serialization overhead, ensures atomic multi-table PostgreSQL transactions via Prisma, and simplifies developer onboarding.

### 3. Server-Authoritative Pricing with Client Preview
- **The Decision**: The mobile and web wizards compute client-side pricing previews using `calculateOrderTotals()` from `@growfast/shared-types`, but the backend authoritatively re-calculates all line totals, express surcharges, and taxes in a database transaction before committing.
- **Why It Fits**: Protects financial integrity against client tampering, stale local pricing tables, or floating-point rounding discrepancies while maintaining instantaneous UI feedback.
