# GrowFast — Laundry & Dry-Cleaning Management System

A production-quality laundry management system built as a TypeScript monorepo.

## Tech Stack

| Layer    | Technology                                |
| -------- | ----------------------------------------- |
| Backend  | NestJS + TypeScript + Prisma + PostgreSQL |
| Frontend | React + Vite + TypeScript + Tailwind CSS  |
| Shared   | TypeScript shared types, enums, DTOs      |
| Database | PostgreSQL 16 (Docker)                    |
| Auth     | JWT + bcrypt PIN                          |
| CI       | GitHub Actions                            |

## Quick Start

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Start PostgreSQL
docker compose up -d

# 3. Install dependencies
npm install

# 4. Setup database
npm run db:generate
npm run db:migrate
npm run db:seed

# 5. Start development
npm run dev:backend   # Terminal 1 — http://localhost:3000/api
npm run dev:web       # Terminal 2 — http://localhost:5173
```

## Project Structure

```
apps/
  backend/           NestJS REST API
  web/               React PWA frontend
packages/
  shared-types/      Shared enums, DTOs, contracts
  ui/                Reusable design system
docs/                Project documentation
prisma/              Database schema & migrations
.github/workflows/   CI/CD
```

## Documentation

- [Requirements Analysis](docs/requirements-analysis.md)
- [Architecture](docs/architecture.md)
- [Database](docs/database.md)
- [API](docs/api.md)
- [Business Rules](docs/business-rules.md)
- [Development Guide](docs/development-guide.md)
- [Testing](docs/testing.md)
- [Roadmap](docs/roadmap.md)

## Development Credentials

| Role     | Employee ID      | PIN    |
| -------- | ---------------- | ------ |
| Owner    | emp-owner-001    | 111111 |
| Manager  | emp-mgr-001      | 222222 |
| Counter  | emp-counter-001  | 333333 |
| Delivery | emp-delivery-001 | 444444 |

⚠️ Development only — never use in production.
