# AGENTS.md - AI Agent Operating Guidelines

Welcome AI agent! This repository is **Test Report Portal**, an automated test reports application storing test result historical data and providing AI-assisted failure analysis. 

Please read and adhere strictly to these guidelines when making code changes, generating tests, or refactoring code in this repository.

---

## 1. Project Overview & Core Goals

- **Repository Type**: Monorepo managed with Turborepo (`turbo`) and `npm` workspaces.
- **Core Mission**: Store, visualize, and analyze automated test executions over time, with AI-powered diagnostics.
- **Primary Goal for AI Agents**: Write clean, modern, well-tested TypeScript code without breaking existing API contracts or monorepo build tools.

---

## 2. Tech Stack Details

| Component | Technology | Version / Notes |
| :--- | :--- | :--- |
| **Package Manager** | `npm` | `11.7.0` (Node.js >= 20.0.0) |
| **Monorepo Engine** | `Turborepo` | `^2.10.7` |
| **Backend App (`apps/api`)** | NestJS, Express, GraphQL (Apollo), TypeScript | NestJS 11, Node 22 types |
| **Frontend App (`apps/web`)** | Next.js, React, Tailwind CSS | Next.js 16, React 19, Tailwind CSS v4 |
| **Shared Code (`packages/shared`)**| Shared TypeScript utilities & types | Monorepo internal workspace package |
| **Testing Framework** | Jest, React Testing Library, Supertest | Jest 30 (`apps/api`) / Jest 29 (`apps/web`) |
| **Code Formatting & Linting** | Prettier, ESLint | Managed across workspaces via Turborepo |

---

## 3. Essential Development Commands

All commands should be executed from the **repository root directory**.

### Installation
```bash
npm ci
```

### Development Servers
```bash
# Start all application development servers in parallel
npm run dev

# Start NestJS backend API only
npm run dev:api
```

### Build & Compilation
```bash
# Build all apps and packages in monorepo dependency order
npm run build

# Build NestJS backend API only
npm run build:api
```

### Testing
```bash
# Run all unit test suites across the monorepo
npm test

# Generate test coverage reports
npm run coverage

# Run agent-specific helper tests
npm run test:agents
```

### Code Quality & Formatting
```bash
# Check code formatting compliance across monorepo
npm run format:check

# Automatically fix code formatting across monorepo
npm run format

# Run linter checks across all packages
npm run lint
```

---

## 4. Repository Structure Breakdown

```
test-report/
├── .github/
│   └── workflows/          # GitHub Actions CI/CD pipelines (PR validation, AI test generation)
├── .agents/                # Custom agent skills, workflows, and rules
├── apps/
│   ├── api/                # NestJS Backend API
│   │   ├── src/            # Source code (Controllers, Services, GraphQL Resolvers)
│   │   └── test/           # E2E and Jest integration tests
│   └── web/                # Next.js Frontend Application
│       └── src/            # Pages, Components, and Hooks
├── packages/
│   └── shared/             # Shared TypeScript models, utilities, and DTOs
├── scripts/                # Repository utility and testing scripts
├── AGENTS.md               # AI Agent operating guide (this file)
├── turbo.json              # Turborepo task pipeline configuration
└── package.json            # Root workspace definitions and npm scripts
```

---

## 5. Coding Conventions & Best Practices

### Git Commit & Branch Naming
- **Commit Style**: Use **Conventional Commits**:
  - `feat: add AI failure analysis endpoint`
  - `fix: correct GraphQL schema type for test runs`
  - `docs: update setup guide in README`
  - `test: add unit tests for report parser`
  - `refactor: optimize database query in test run service`
- **Branch Naming**: Use prefixed branch names:
  - `feat/feature-name`
  - `fix/bug-fix-name`

### TypeScript Guidelines
- Enable strict mode compliance; never use `any` when explicit types can be inferred or declared.
- Place shared DTOs and data models in `packages/shared` if they are consumed by both `apps/api` and `apps/web`.

### Testing Standards
- Every new feature or service method MUST include corresponding Jest unit tests.
- Backend tests live next to source files (`.spec.ts`) or in `apps/api/test/`.
- Frontend component tests use `@testing-library/react` and live in `__tests__` or `.test.tsx` files.
- Always run `npm test` before declaring a task finished.

### Agent Do's and Don'ts

#### DO:
- ✅ Run `npm run format` and `npm run lint` after editing code to ensure formatting is clean.
- ✅ Run `npm test` to verify that existing test suites pass.
- ✅ Follow existing NestJS modular architecture (`apps/api`) and Next.js App directory layout (`apps/web`).

#### DON'T:
- ❌ Do NOT suppress or ignore linting/compiler errors by adding `@ts-ignore` unless explicitly requested.
- ❌ Do NOT alter root-level dependency versions without checking workspace compatibility.
- ❌ Do NOT write code logic without corresponding automated tests.
