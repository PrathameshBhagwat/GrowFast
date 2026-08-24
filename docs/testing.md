# Testing Strategy

## Test Pyramid

1. **Unit Tests** — Business logic, services, utilities
2. **Integration Tests** — API endpoints with database
3. **E2E Tests** — Full user flows (future)

## Backend Testing

### Framework

- **Jest** with `ts-jest`
- **@nestjs/testing** for module testing

### What to Test

- ✅ Authentication (PIN validation, JWT generation)
- ✅ Authorization (role guards)
- ✅ Financial calculations (pricing, discounts, payments)
- ✅ Business logic (order status derivation, due dates)
- ✅ Input validation
- ❌ Prisma queries (tested via integration tests)
- ❌ NestJS decorators

### Running Tests

```bash
npm run test --workspace=apps/backend           # All tests
npm run test:watch --workspace=apps/backend      # Watch mode
npm run test:cov --workspace=apps/backend        # Coverage report
```

## Frontend Testing

- Currently: TypeScript compilation as validation
- Future: Vitest + React Testing Library

## Shared Types Testing

- TypeScript compilation validates type correctness
- `deriveOrderStatus()` should have unit tests

## CI Testing

Every PR runs:

1. TypeScript typecheck (all workspaces)
2. Backend build
3. Frontend build
4. Backend unit tests
