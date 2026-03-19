---
name: drizzle
description: Drizzle ORM patterns for Nexum — schema-per-tenant multi-tenancy, migration conventions, query building, relation definitions, and tenant isolation middleware. Triggers when working with database schemas, migrations, ORM queries, or tenant isolation.
user-invocable: false
---

# Drizzle ORM — Nexum Patterns

Nexum uses Drizzle ORM 0.45 with PostgreSQL 15, schema-per-tenant multi-tenancy, and Zod 4 integration via `drizzle-zod`.

## Schema-Per-Tenant Architecture

### How It Works
- Each tenant gets their own PostgreSQL schema: `tenant_{uuid}`
- The `public` schema holds shared data: tenant registry, Better Auth tables, billing, system config
- Every query is scoped to the correct tenant schema via middleware
- Cross-tenant access is architecturally impossible at the ORM layer

### Tenant Scoping Middleware
```typescript
// Every request sets the search path based on the authenticated session's tenant
// This is Fastify preHandler middleware, not Drizzle middleware
// The Drizzle client is configured per-request with the correct schema

// Pattern: create a scoped Drizzle instance per request
function getTenantDb(tenantId: string) {
  // Set search_path to tenant schema, then public (for auth tables)
  // All subsequent queries in this connection use the tenant schema
}
```

### Soft Delete Middleware
```typescript
// Drizzle query middleware that automatically adds WHERE deleted_at IS NULL
// Applied alongside tenant scoping — both are transparent to route handlers
// Handlers never manually filter deleted records
```

## Schema Definitions

### Table Standards (ALL tables)
```typescript
import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';

// Every table MUST have these columns
const baseColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // soft delete
};
```

### Public Schema Tables
```typescript
// Tenant registry, Better Auth tables, platform admin, billing
// These are in the default public schema
export const tenants = pgTable('tenants', {
  ...baseColumns,
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  // subscription, settings, etc.
});
```

### Tenant Schema Tables
```typescript
// All business data lives in tenant schemas
// Schema name: tenant_{uuid}
// Define once, apply to every tenant schema via migrations
export const companies = pgTable('companies', {
  ...baseColumns,
  name: varchar('name', { length: 255 }).notNull(),
  abn: varchar('abn', { length: 11 }),
  isCustomer: boolean('is_customer').notNull().default(false),
  isContractor: boolean('is_contractor').notNull().default(false),
  isSupplier: boolean('is_supplier').notNull().default(false),
  // ...
});
```

## Migration Conventions

### Rules
1. **Never modify existing migrations** — only add new ones
2. **Migrations are forward-only** — no auto-rollback, create corrective migrations instead
3. **Every migration must work on both new and existing tenant schemas**
4. **Test migrations on a copy before applying to production**

### Migration Files
```
packages/backend/src/db/
  migrations/
    public/          # Public schema migrations
      0001_create_tenants.ts
      0002_create_auth_tables.ts
    tenant/          # Tenant schema migrations (applied to every tenant)
      0001_create_companies.ts
      0002_create_contacts.ts
      0003_create_addresses.ts
  schema/
    public/          # Public schema definitions
      tenants.ts
      auth.ts
    tenant/          # Tenant schema definitions
      companies.ts
      contacts.ts
      addresses.ts
      index.ts       # Re-exports all tenant tables
```

### Migration Commands
```bash
pnpm db:migrate           # Migrate public schema + all tenant schemas
pnpm db:migrate:public    # Migrate public schema only
pnpm db:migrate:tenants   # Migrate all tenant schemas only
pnpm db:migrate:tenant <id>  # Migrate a specific tenant schema
pnpm db:generate          # Generate migration from schema changes
```

### Migration Runner
- A `migrate-all-tenants` BullMQ job iterates all active tenant schemas
- Each tenant migration is wrapped in its own transaction
- Failed tenants are logged and flagged for manual retry
- Runs automatically on application startup after public schema is migrated

## Query Patterns

### Basic CRUD
```typescript
// INSERT — always returns the created record
const company = await db.insert(companies).values({
  name: 'Farrell Transport',
  abn: '12345678901',
  isCustomer: true,
}).returning();

// SELECT — soft delete filter is automatic via middleware
const activeCompanies = await db.select().from(companies)
  .where(eq(companies.isCustomer, true));

// UPDATE — always update updatedAt
const updated = await db.update(companies)
  .set({ name: 'New Name', updatedAt: new Date() })
  .where(eq(companies.id, companyId))
  .returning();

// SOFT DELETE — set deletedAt, never use db.delete()
const deleted = await db.update(companies)
  .set({ deletedAt: new Date() })
  .where(eq(companies.id, companyId))
  .returning();
```

### Transactions
```typescript
// All write operations that touch multiple tables MUST use transactions
await db.transaction(async (tx) => {
  const company = await tx.insert(companies).values({ ... }).returning();
  await tx.insert(contacts).values({ companyId: company[0].id, ... });
  await tx.insert(auditLog).values({
    entityType: 'company',
    entityId: company[0].id,
    action: 'create',
    // ...
  });
  // If any step fails, everything rolls back
});
```

### Relations
```typescript
import { relations } from 'drizzle-orm';

export const companiesRelations = relations(companies, ({ many }) => ({
  contacts: many(contacts),
  addresses: many(addresses),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
}));
```

## Drizzle-Zod Integration

```typescript
import { createSelectSchema, createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Generate Zod schemas from Drizzle table definitions
export const selectCompanySchema = createSelectSchema(companies);
export const insertCompanySchema = createInsertSchema(companies, {
  // Override specific fields for validation
  abn: z.string().length(11).regex(/^\d+$/),
  name: z.string().min(1).max(255),
});

// Derive types from Zod (never define separately)
export type Company = z.infer<typeof selectCompanySchema>;
export type NewCompany = z.infer<typeof insertCompanySchema>;
```

## Indexing Rules
- Index ALL foreign key columns
- Index commonly queried fields (status, type, name)
- Index `deleted_at` for soft delete filtering
- Composite indexes for common query patterns (e.g., `[companyId, isActive]`)
- GIN indexes on JSONB columns used in queries

## Audit Logging
```typescript
// Every write operation must create an audit log entry
export const auditLog = pgTable('audit_log', {
  ...baseColumns,
  userId: uuid('user_id').notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 50 }).notNull(), // create, update, delete
  previousData: jsonb('previous_data'), // snapshot before change
  newData: jsonb('new_data'),           // snapshot after change
  metadata: jsonb('metadata'),          // request context, IP, etc.
});
```
