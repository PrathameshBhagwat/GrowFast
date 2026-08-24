# Requirements Analysis

## System Overview

A production-quality Laundry & Dry-Cleaning Management System for Indian laundry businesses. The system manages the complete lifecycle from order intake to delivery, including garment tracking, payments, and customer management.

## User Roles

| Role         | Description      | Key Permissions                                       |
| ------------ | ---------------- | ----------------------------------------------------- |
| **Owner**    | Business owner   | Full access, analytics, settings, employee management |
| **Manager**  | Store manager    | Orders, customers, processing, reports, pricing       |
| **Counter**  | Front desk staff | New orders, customer lookup, payments, order status   |
| **Delivery** | Delivery rider   | Delivery tasks, pickups, collections, proof photos    |

## Core Entities

1. **Store** — Physical branch location
2. **Employee** — Staff with role-based PIN login
3. **Customer** — Client with preferences, membership, history
4. **Garment Catalog** — Available garment types (Shirt, Saree, etc.)
5. **Service Type** — Services offered (Dry Clean, Steam Press, etc.)
6. **Order** — Customer order with items, pricing, status
7. **Order Item** — Individual garment in an order
8. **Order Photo** — Photo evidence (intake, damage, delivery)
9. **Payment** — Payment record against an order
10. **Delivery Record** — Delivery/pickup task

## Business Rules (V1)

- **Due-date calculation**: System-calculated based on service type estimated days
- **Due-date overrides**: Manager/Owner can override with audit trail
- **Express service**: Expedited processing with surcharge
- **Partial delivery**: Items can be delivered incrementally
- **Payment status**: PENDING → PARTIAL → PAID based on payments received
- **Photo proof**: Intake photos for damage documentation, delivery proof
- **Order status derivation**: Derived from item statuses (single source of truth)

## V1 Scope

- Employee PIN authentication
- Customer CRUD
- Order creation and management
- Garment catalog and pricing
- Payment recording
- Basic delivery management
- Photo capture (intake)
- Dashboard with KPIs

## Deferred to V2+

- Offline/PWA sync
- WhatsApp notifications
- Mobile native app
- Advanced analytics
- Multi-store management
- Inventory management
- Expense tracking
- QR/barcode scanning

## Ambiguities Documented

1. **Tax calculation**: No specific tax rules in requirements. Currently defaults to 0. May need GST integration.
2. **Discount rules**: Membership-based discount is stored but automatic application logic is not defined.
3. **Multi-store**: Schema supports it, but V1 UI assumes single-store operation.
4. **Weight-based pricing**: Schema supports it, but calculation formula is not fully specified.
