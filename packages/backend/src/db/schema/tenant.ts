import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  numeric,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// ── Organisation (tenant's business identity) ──

export const organisation = pgTable("organisation", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  tradingName: varchar("trading_name", { length: 255 }),
  abn: varchar("abn", { length: 11 }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  website: varchar("website", { length: 500 }),
  logoUrl: text("logo_url"),
  registeredAddress: text("registered_address"),
  bankBsb: varchar("bank_bsb", { length: 6 }),
  bankAccountNumber: varchar("bank_account_number", { length: 20 }),
  bankAccountName: varchar("bank_account_name", { length: 255 }),
  defaultPaymentTerms: integer("default_payment_terms").notNull().default(30),
  timezone: varchar("timezone", { length: 50 }).notNull().default("Australia/Brisbane"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Companies (customers, contractors, suppliers) ──

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    tradingName: varchar("trading_name", { length: 255 }),
    abn: varchar("abn", { length: 11 }),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 255 }),
    website: varchar("website", { length: 500 }),
    isCustomer: boolean("is_customer").notNull().default(false),
    isContractor: boolean("is_contractor").notNull().default(false),
    isSupplier: boolean("is_supplier").notNull().default(false),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    notes: text("notes"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("companies_status_idx").on(table.status),
    index("companies_is_customer_idx").on(table.isCustomer),
    index("companies_is_contractor_idx").on(table.isContractor),
    index("companies_is_supplier_idx").on(table.isSupplier),
  ],
);

// ── Contacts ──

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    title: varchar("title", { length: 100 }),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 255 }),
    companyId: uuid("company_id").references(() => companies.id),
    addressId: uuid("address_id").references(() => addresses.id),
    preferredContactMethod: varchar("preferred_contact_method", { length: 10 })
      .notNull()
      .default("email"),
    smsOptIn: boolean("sms_opt_in").notNull().default(false),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("contacts_company_id_idx").on(table.companyId),
    index("contacts_address_id_idx").on(table.addressId),
  ],
);

// ── Addresses ──

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    streetAddress: varchar("street_address", { length: 500 }).notNull(),
    suburb: varchar("suburb", { length: 100 }).notNull(),
    state: varchar("state", { length: 3 }).notNull(),
    postcode: varchar("postcode", { length: 4 }).notNull(),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    regionId: uuid("region_id").references(() => regions.id),
    types: jsonb("types").$type<string[]>().notNull().default([]),
    operatingHours: text("operating_hours"),
    accessConditions: text("access_conditions"),
    siteNotes: text("site_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("addresses_region_id_idx").on(table.regionId),
    index("addresses_state_idx").on(table.state),
  ],
);

// ── Company Addresses (many-to-many) ──

export const companyAddresses = pgTable(
  "company_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    addressId: uuid("address_id")
      .notNull()
      .references(() => addresses.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("company_addresses_company_id_idx").on(table.companyId),
    index("company_addresses_address_id_idx").on(table.addressId),
  ],
);

// ── Entry Points ──

export const entryPoints = pgTable(
  "entry_points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    addressId: uuid("address_id")
      .notNull()
      .references(() => addresses.id),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    vehicleRestrictions: text("vehicle_restrictions"),
    weightLimit: numeric("weight_limit", { precision: 10, scale: 2 }),
    operatingHours: text("operating_hours"),
    driverInstructions: text("driver_instructions"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("entry_points_address_id_idx").on(table.addressId)],
);

// ── Regions ──

export const regions = pgTable("regions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  boundary: jsonb("boundary"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Roles & Permissions ──

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).notNull(),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Audit Log ──

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    action: varchar("action", { length: 20 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id"),
    previousData: jsonb("previous_data"),
    newData: jsonb("new_data"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_log_user_id_idx").on(table.userId),
    index("audit_log_entity_type_idx").on(table.entityType),
    index("audit_log_entity_id_idx").on(table.entityId),
    index("audit_log_created_at_idx").on(table.createdAt),
  ],
);
