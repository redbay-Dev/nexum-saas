# Changelog

All notable changes to the Nexum project will be documented in this file.

## [0.1.0] — 2026-03-19

### Phase 1: Monorepo Scaffold

**What was built:**
- Monorepo structure with pnpm 10 workspaces + Turborepo 2.8
- `@nexum/shared` — Zod 4 validation schemas, TypeScript types (derived from Zod), constants (all enums), utility functions (ABN validation, AU phone formatting, date/currency formatting), RBAC permissions system
- `@nexum/backend` — Fastify 5 server with health check endpoint, config loader, Drizzle ORM 0.45 schema definitions (public + tenant), multi-tenant database client with connection caching, tenant/permission middleware, dual drizzle configs (public + tenant schemas)
- `@nexum/frontend` — React 19 + Vite 8 + Tailwind CSS 4 (CSS-first config with @tailwindcss/vite) + shadcn/ui v4 CSS variables + React Router 7 + Zustand 5 + TanStack Query 5, landing page component
- `@nexum/pdf-templates` — Handlebars helpers (Australian date/currency/ABN formatting), tsup build
- Root configs: tsconfig.base.json (strict: true), ESLint 10 flat config, Prettier 3.8, turbo.json
- `.claude/` commands (/checks, /continue, /audit, /create-handler, /create-component) and skills (shadcn, drizzle, fastify, testing)
- `.env.example` with all connection strings (PostgreSQL, Redis, MinIO, SMTP, Auth)
- Tests: ABN validation, phone formatting, date/currency formatting, Handlebars helpers, health check endpoint, React App component

**Decisions made:**
- API port 3002 (SafeSpec uses 3001), frontend port 5174 (SafeSpec uses 5173)
- Redis key prefix `nexum:` (SafeSpec uses `safespec:`)
- Database name `nexum_dev` (SafeSpec uses `safespec_dev`)

**Known issues:**
- None at scaffold stage

**What's STILL MISSING (Phase 1):**
- `pnpm install` and dependency resolution
- Build verification (`pnpm build`, `pnpm lint`, `pnpm type-check`, `pnpm test`)
- Husky pre-commit hooks not yet configured
- shadcn/ui CLI init not yet run (components not installed)

**What's next:**
- Verify build passes with zero errors
- Phase 2: Database foundation (public schema migration, tenant schema template, provisioning, middleware)
- Phase 3: Better Auth integration, user management, permission system
