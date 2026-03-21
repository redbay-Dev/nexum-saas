import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";

/**
 * Tenant registry — one row per paying customer of the Nexum platform.
 * Lives in the public schema. The tenant's business identity is in their
 * own schema's `organisation` table.
 */
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** OpShield's tenant UUID — links to OpShield's tenant registry */
  opshieldTenantId: uuid("opshield_tenant_id").unique(),
  name: varchar("name", { length: 255 }).notNull(),
  schemaName: varchar("schema_name", { length: 63 }).notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  plan: varchar("plan", { length: 50 }).notNull().default("starter"),
  enabledModules: jsonb("enabled_modules").$type<string[]>().default([]),
  billingEmail: varchar("billing_email", { length: 255 }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Mapping between users and tenants.
 * A user belongs to exactly one tenant.
 */
export const tenantUsers = pgTable("tenant_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** OpShield user UUID — identity comes from OpShield, not Nexum */
  userId: text("user_id").notNull(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  role: varchar("role", { length: 50 }).notNull().default("read_only"),
  isOwner: boolean("is_owner").notNull().default(false),
  /** Display name cached from OpShield (denormalised for convenience) */
  displayName: varchar("display_name", { length: 255 }),
  /** Email cached from OpShield (denormalised for convenience) */
  email: varchar("email", { length: 255 }),
  /** Account status — active or deactivated */
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Platform admin users (separate from tenant users).
 */
export const platformAdmins = pgTable("platform_admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
