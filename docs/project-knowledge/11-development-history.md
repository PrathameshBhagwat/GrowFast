# 11 — Project History & Chronological Milestones

## 1. Development Methodology & Governance

The GrowFast monorepo was developed following strict team ownership boundaries defined in `AGENTS.md`:
- **Developer A**: Authentication, Employee directory, Customer registration and profiles.
- **Developer B**: Catalog management, service matrices, order creation wizard, and canonical status rules.
- **Developer C / Tech Lead**: Media/photo storage, delivery dispatch, payments ledger, WhatsApp notifications, operational dashboard, and Mobile POS offline architecture.

Branching model: Independent feature branches (`Order_Workflow_Dev_B`, `Developer-C-Delivery`, `integration/developer-b-and-c`) merged into `main` after automated test suites and typechecking pass.

---

## 2. Chronological Milestones & Engineering Evolution

### Milestone 1: Monorepo Foundation & Core Schema
- **Scope**: Established root npm workspaces, PostgreSQL 16 schema with Prisma ORM 5.20.0, NestJS 10 backend skeleton, React 19 web application, and zero-dependency `@growfast/shared-types`.
- **Engineering Challenge**: Avoiding enum divergence between frontend and backend.
- **Solution**: Centralized enums (`OrderStatus`, `ItemStatus`, `Role`, `PaymentMode`) in `@growfast/shared-types` with strict import enforcement.

### Milestone 2: Authentication & Physical Garment Readiness
- **Key Commits**: `fa9723e`, `fb83a35`, `2c15cd8`
- **Scope**: Implemented PIN-based auth using `bcryptjs` and `@nestjs/jwt`. Introduced `PhysicalGarment` unit records to track individual clothes independently of order line items.
- **Engineering Challenge**: Prevent mobile and web counter terminals from crashing or wiping user state when Wi-Fi fluctuated during PIN entry.
- **Solution**: Removed aggressive token destruction on transient HTTP network errors (`fb83a35`).

### Milestone 3: Human-Readable Business Identifiers & Production Workflow
- **Key Commits**: `a8f37e7`, `f8bf462`, `d792c10`
- **Scope**: Replaced raw UUIDs in customer-facing contexts with atomic sequential IDs (`GF-C-XXXX` for customers, `ORD-YYYYMMDD-XXXX` for orders, `GF-XXXXXX` for thermal adhesive garment tags).
- **Engineering Challenge**: Ensuring non-colliding sequential numbers across concurrent counter terminals without locking the entire `orders` table.
- **Solution**: Introduced `BusinessSequence` table with atomic update transactions.

### Milestone 4: Domain Rule Specialization (Laundry vs Dry Cleaning)
- **Key Commits**: `aa61de7`, `3448309`, `5018fe8`, `c92f271`
- **Scope**: Implemented deep domain segregation:
  - Dry Cleaning defaulted to per-piece workflow with individual barcode tags.
  - Laundry established as weight-based (minimum 2.00 kg requirement).
  - Starching restricted to `MEN`, `WOMEN`, `KIDS`.
  - Automatic Thursday weekly off day due-date rollover (`adjustDueDateForThursday`).
  - Added statutory bill notices (15-day collection policy, stain removal disclaimer).

### Milestone 5: Thermal Tag Designer & Express Delivery Multipliers
- **Key Commits**: `be3d781`, `f6c4bdf`, `7b3dc4c`, `fad429c`
- **Scope**: 
  - Dynamic Express Delivery pricing engine: Same-day delivery (2.0× multiplier), Tomorrow evening delivery (1.5× multiplier), Regular delivery (0×).
  - Web-based Drag-and-Drop 40×40 mm Thermal Tag Designer for TSC TE244 printers using wet strength paper.
  - 50-photo threshold optimization and compact Order Wizard UI.

### Milestone 6: Automated Notifications & Real-Time Analytics Dashboard
- **Key Commits**: `30b6407`, `2870073`, `1b16e81`, `ed3357e`
- **Scope**:
  - Headless PDF receipt generation via PDFKit with WhatsApp message templating via Baileys multi-device socket.
  - Full operational analytics engine: Today's collections, outstanding receivables, refund tracking, and Action Center alert queues.
- **Engineering Challenge**: Financial metrics drifting across timezone midnight boundaries.
- **Solution**: Standardized all backend daily aggregation filters to `Asia/Kolkata` midnight-to-midnight timestamps (`2870073`).

### Milestone 7: Integration, Conflict Resolution & Security Hardening
- **Key Commits**: `b8dafac`, `1ec55c7`, `f676822`, `4f39013`, `af0cda0`
- **Scope**: Unified Developer B and Developer C codebases. Resolved TS2367 enum narrowing issues, added CSV formula injection defenses on report exports, deduplicated add-on services, and pinned system time in Jest to ensure deterministic financial tests.

### Milestone 8: Mobile POS & Offline-First Engineering (Phases E, E.1, F)
- **Scope**:
  - Built mobile client (`apps/mobile`) on Expo SDK 52 and React Native 0.76.9.
  - Created offline SQLite draft store (`order_drafts`, `pending_photos`).
  - Implemented `SyncEngine` with mutex concurrency locks, bounded exponential backoff with jitter, and post-timeout recovery (`getByDraftId`).
  - Solved React 19 vs 18 monorepo version conflict and Expo Metro module resolution.
  - Verified live login and order creation on a physical Android device over LAN (`192.168.1.38`).
