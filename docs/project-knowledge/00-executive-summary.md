# Executive Summary — GrowFast Laundry & Dry-Cleaning Management System

> **Document Type:** Project Executive Summary & Technical Audit  
> **Repository:** `GrowFast` Monorepo  
> **Audited Date:** October 2026  
> **System Status:** Production-Ready Core Architecture / Active Multi-Platform Integration  

---

## 1. What is GrowFast?

**GrowFast** is an enterprise-grade, multi-platform laundry and dry-cleaning management system designed to streamline retail point-of-sale (POS), garment lifecycle tracking, workshop fulfillment, doorstep pickup and delivery, and financial settlement for multi-branch dry-cleaning businesses.

Built as a high-performance TypeScript monorepo, the platform unifies three primary user experiences:
1. **Cloud Web Portal (`apps/web`)**: A desktop-optimized progressive web application for store managers, owners, and counter staff featuring order intake wizards, staff administration, visual garment tag designers, analytics dashboards, and delivery dispatch.
2. **Mobile POS & Rider Application (`apps/mobile`)**: An offline-first React Native & Expo application running on physical Android devices and counter tablets, engineered to handle order intake, camera-based defect photo capture, offline draft recovery, and in-person payment collection.
3. **Enterprise REST API (`apps/backend`)**: A robust NestJS micro-monolith providing server-side business-rule enforcement, distributed order and payment idempotency, barcode/tag sequence generation, WhatsApp customer notifications, and Cloudflare R2 / AWS S3 garment image storage.

---

## 2. The Business Problem It Solves

Traditional retail laundry and dry-cleaning services suffer from severe operational vulnerabilities:
- **Lost and Mixed Garments**: In manual or fragmented POS systems, individual garments in a multi-piece order lose their physical identity, leading to missing garments, customer disputes, and costly store compensation.
- **Pre-existing Defect Disputes**: Customers frequently accuse dry cleaners of creating stains, tears, or broken buttons that existed before intake.
- **Unreliable Network in Retail Outlets**: Store counters and mobile riders operate in environments with intermittent internet connectivity, leading to dropped orders, lost transactions, or duplicate billing.
- **Complex Pricing & Turnaround Times**: Dry-cleaning is strictly per-piece, whereas wash-and-fold laundry is billed per kilogram with a mandatory minimum weight (2.00 kg). Surcharges for same-day (2.0×) and next-day evening (1.5×) delivery must adjust for weekly plant closures (e.g., Thursday weekly off).
- **Audit Gaps in Cash Collection**: Without strict server-side payment idempotency and immutable transaction ledgers, cash-on-delivery and split payments (cash + UPI) result in accounting leakage.

GrowFast solves these problems through an automated garment tagging engine (`GF-XXXXXX`), mandatory photo inspection workflows, offline SQLite draft synchronization with SHA-256 idempotency fingerprinting, and a mathematically unified pricing and status state machine.

---

## 3. Monorepo Architecture at a Glance

```
GrowFast Monorepo (npm workspaces)
├── apps/
│   ├── backend/         → NestJS 10, Prisma ORM 5, PostgreSQL 16, JWT, Baileys WhatsApp, Cloudflare R2
│   ├── web/             → React 19, Vite 6, Tailwind CSS v4, React Router DOM 7
│   └── mobile/          → React Native 0.76.9, Expo SDK 52, Expo Router v4, SQLite 15, SecureStore 14
├── packages/
│   ├── shared-types/    → Canonical enums, DTOs, pricing logic, order-status state machine
│   └── ui/              → Shared React 19 Web design system & Tailwind CSS UI components
├── prisma/              → Unified PostgreSQL schema, migrations, and development seed scripts
└── docs/                → Architectural specifications, developer contracts, and audit reports
```

---

## 4. Current System Maturity & Evidence Summary

| Domain | Implementation State | Verification Evidence |
|---|---|---|
| **Authentication & RBAC** | **Verified & Working** | PIN authentication with bcrypt (10 rounds), JWT validation, NestJS `RolesGuard`. Role-scoped access for `OWNER`, `MANAGER`, `COUNTER`, `DELIVERY`. Backend unit tests (8/8 pass). |
| **Garment Tagging & Identity** | **Verified & Working** | Unique alphanumeric tag IDs (`GF-XXXXXX`) generated for every physical piece. Tag template designer UI for 40×40 mm thermal printers. |
| **Order Engine & Pricing** | **Verified & Working** | Authoritative calculation of subtotal, express multipliers (1.5×, 2.0×), 18% GST, and minimum 2.00 kg weight rules. 300 backend tests pass. |
| **Canonical Order Status** | **Verified & Working** | Single source of truth via `deriveOrderStatus()` in `@growfast/shared-types`. No module manually sets canonical order status. |
| **Mobile Offline POS** | **Verified & Working** | Local SQLite storage for drafts and photos, background sync engine with exponential backoff & jitter, SHA-256 idempotency fingerprinting. 65 mobile tests pass. |
| **Payments & Idempotency** | **Verified & Working** | Full and partial payment collection (Cash, UPI, Card), client duplicate locking, server-enforced unique idempotency keys, balance derivation. |
| **Real-Device Android Testing** | **Verified & Working** | Expo SDK 52 app bundled and executed on physical Android device connected via LAN (`192.168.1.38:8081` Metro, `:3000` API). |
| **Web Production Build** | **Verified & Working** | Vite 6 + Tailwind CSS v4 builds cleanly with zero errors (1,901 modules transformed). |

---

## 5. Key Business Metrics & Capabilities Supported

- **Zero-Collision Parallel Development**: Strict module ownership contracts enabled three engineers (Developer A, B, and C) to work concurrently across 15+ backend modules and 20+ web pages without merge conflicts.
- **100% Deterministic Idempotency**: Order submissions and payment collections utilize client-generated keys and SHA-256 payload hashes, guaranteeing that network retries or connection drops never produce duplicate orders or double charges.
- **Physical Defect Liability Protection**: Intake workflow enforces image capture for walk-in orders, storing photos with front/back/defect classifications linked directly to individual physical garments.
- **Instant Customer Updates**: Native WhatsApp notification worker with QR pairing (`@whiskeysockets/baileys`) sends transactional updates on order creation, fulfillment, and delivery.
