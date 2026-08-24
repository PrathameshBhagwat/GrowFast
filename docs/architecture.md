# System Architecture

## Overall Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (PWA)                    │
│              React + Vite + Tailwind CSS             │
│                   Port: 5173                         │
└────────────────────────┬────────────────────────────┘
                         │ REST API (JSON)
                         │ JWT Bearer Token
┌────────────────────────┴────────────────────────────┐
│                    Backend (API)                     │
│                NestJS + TypeScript                   │
│                   Port: 3000                         │
└────────────────────────┬────────────────────────────┘
                         │ Prisma ORM
┌────────────────────────┴────────────────────────────┐
│                    Database                          │
│                PostgreSQL 16                         │
│                   Port: 5432                         │
└─────────────────────────────────────────────────────┘
```

## Frontend Architecture

- **Framework**: React 19 with Vite
- **Routing**: React Router v7
- **State**: React Context for auth; future: Zustand or React Query for data
- **Styling**: Tailwind CSS v4
- **Design System**: `@growfast/ui` package with reusable components
- **PWA**: Service worker for offline capability (future)

## Backend Architecture

- **Framework**: NestJS with TypeScript
- **API Style**: REST with JSON
- **ORM**: Prisma with PostgreSQL
- **Auth**: JWT with bcrypt PIN hashing
- **Validation**: class-validator + class-transformer
- **Module Structure**: Feature-based modules (auth, order, customer, etc.)

## Authentication Architecture

1. Employee selects their profile on login screen
2. Enters 6-digit PIN
3. Backend verifies PIN hash (bcrypt) and returns JWT
4. Frontend stores JWT in localStorage
5. All API calls include `Authorization: Bearer <token>`
6. Backend JwtAuthGuard validates token on every request
7. RolesGuard checks user role against `@Roles()` decorator

## Authorization Architecture

- Server-side enforcement via NestJS guards
- `@Roles('OWNER', 'MANAGER')` decorator on controller methods
- Frontend role checks are UX-only, not security

## Shared Package Architecture

```
packages/shared-types/
  src/
    enums.ts        → Role, OrderStatus, PaymentStatus, etc.
    dto.ts          → API request/response contracts
    order-status.ts → deriveOrderStatus() + status colors
    index.ts        → Barrel exports
```

## Module Boundaries & Dependency Direction

```
shared-types ← ui ← web
shared-types ← backend
```

- `shared-types` has NO dependencies on other packages
- `ui` depends on `shared-types` only
- `web` depends on `shared-types` and `ui`
- `backend` depends on `shared-types` only

## Storage Architecture (Future)

- Photos stored in cloud storage (S3/GCS)
- URLs stored in database `order_photos` table
- `PhotoCapture` component provides file to upload service

## Future Mobile Architecture

- React Native or PWA
- Shares `shared-types` package
- Same REST API backend

## Future Offline Architecture

- Service worker for request caching
- IndexedDB for local data
- `SyncStatus` enum tracks sync state per order
- Conflict resolution: server wins
