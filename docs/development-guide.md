# Development Guide

## Prerequisites

- **Node.js** 20+ (LTS)
- **PostgreSQL 16** (via Docker or local service)
- **Git**

---

## 1. Initial Setup for Developers

```bash
# 1. Clone the repository
git clone https://github.com/PrathameshBhagwat/GrowFast.git
cd GrowFast

# 2. Copy environment file
cp .env.example .env

# 3. Start PostgreSQL (if using Docker)
docker compose up -d

# 4. Install dependencies
npm install

# 5. Generate Prisma client
npm run db:generate

# 6. Apply database migrations
npm run db:migrate

# 7. Seed development data
npm run db:seed

# 8. Start backend development server (Terminal 1)
npm run dev:backend   # API at http://localhost:3000/api

# 9. Start frontend development server (Terminal 2)
npm run dev:web       # Web app at http://localhost:5173
```

---

## 2. Developer Feature Workflow

When starting a new task:

```bash
# 1. Always start from the latest clean main branch
git checkout main
git pull origin main

# 2. Create your feature branch (use standard naming)
# Developer A:
git checkout -b feature/customer-search

# Developer B:
git checkout -b feature/catalog-management

# Developer C:
git checkout -b feature/photo-upload

# 3. Implement your feature within your assigned module area
# ... write code and tests ...

# 4. Run local quality checks before committing
npm run typecheck
npm run test
npm run lint
npm run format:check

# 5. Commit and push
git add .
git commit -m "feat(customer): add customer search API and UI"
git push -u origin feature/customer-search

# 6. Open a Pull Request targeting main
# Fill out the pull request template completely and verify CI passes.
```

---

## 3. Development Credentials (Local Development Only)

| Role         | Employee ID        | Default PIN | Access Level                                     |
| ------------ | ------------------ | ----------- | ------------------------------------------------ |
| **Owner**    | `emp-owner-001`    | `111111`    | Full administrative & financial access           |
| **Manager**  | `emp-mgr-001`      | `222222`    | Operations, orders, customers, due-date override |
| **Counter**  | `emp-counter-001`  | `333333`    | Order creation, payments, customer lookup        |
| **Delivery** | `emp-delivery-001` | `444444`    | Delivery tasks, route dispatch, collections      |

⚠️ _These credentials are for development and testing only. Never use in production._

---

## 4. Quality & Verification Scripts

| Task                   | Command                                 | Description                                  |
| ---------------------- | --------------------------------------- | -------------------------------------------- |
| **Typecheck All**      | `npm run typecheck`                     | Checks TypeScript across all packages & apps |
| **Backend Tests**      | `npm run test --workspace=apps/backend` | Runs backend Jest unit tests                 |
| **Shared Types Build** | `npm run build:shared`                  | Builds the `@growfast/shared-types` package  |
| **Backend Build**      | `npm run build:backend`                 | Compiles NestJS application                  |
| **Frontend Build**     | `npm run build:web`                     | Builds React Vite application bundle         |
| **Code Formatting**    | `npm run format`                        | Auto-formats code with Prettier              |
| **Format Check**       | `npm run format:check`                  | Verifies formatting for CI                   |
| **Database Studio**    | `npm run db:studio`                     | Opens Prisma Studio GUI in browser           |
| **Database Reset**     | `npm run db:reset`                      | Resets DB schema and re-runs seed            |
