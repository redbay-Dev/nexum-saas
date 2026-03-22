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
  quotePricingMode: varchar("quote_pricing_mode", { length: 30 }).notNull().default("lock_at_quote"),
  staleRateThresholdDays: integer("stale_rate_threshold_days").notNull().default(180),
  // RCTI configuration (doc 10)
  rctiPaymentFrequency: varchar("rcti_payment_frequency", { length: 20 }).notNull().default("weekly"),
  rctiPaymentDay1: integer("rcti_payment_day_1"),
  rctiPaymentDay2: integer("rcti_payment_day_2"),
  rctiCutoffTime: varchar("rcti_cutoff_time", { length: 5 }).notNull().default("17:00"),
  rctiPaymentTermsDays: integer("rcti_payment_terms_days").notNull().default(7),
  rctiAutoGenerate: boolean("rcti_auto_generate").notNull().default(false),
  rctiRequireApproval: boolean("rcti_require_approval").notNull().default(true),
  rctiGstInclusive: boolean("rcti_gst_inclusive").notNull().default(false),
  rctiAutoEmailOnApproval: boolean("rcti_auto_email_on_approval").notNull().default(false),
  rctiIncludeDocketImages: boolean("rcti_include_docket_images").notNull().default(false),
  rctiEmailStaggerSeconds: integer("rcti_email_stagger_seconds").notNull().default(5),
  rctiSubjectTemplate: text("rcti_subject_template"),
  rctiBodyTemplate: text("rcti_body_template"),
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
    media: jsonb("media").$type<Array<{ url: string; type: string; caption: string | null }>>(),
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
  defaultAssetIds: jsonb("default_asset_ids").$type<string[]>().notNull().default([]),
  defaultDriverIds: jsonb("default_driver_ids").$type<string[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Employees ──

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    dateOfBirth: varchar("date_of_birth", { length: 10 }),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 255 }),
    homeAddress: text("home_address"),
    position: varchar("position", { length: 100 }).notNull(),
    employmentType: varchar("employment_type", { length: 20 }).notNull(),
    startDate: varchar("start_date", { length: 10 }).notNull(),
    department: varchar("department", { length: 100 }),
    isDriver: boolean("is_driver").notNull().default(false),
    contractorCompanyId: uuid("contractor_company_id").references(
      () => companies.id,
    ),
    emergencyContacts: jsonb("emergency_contacts")
      .$type<Array<{ name: string; relationship: string; phone: string }>>()
      .notNull()
      .default([]),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("employees_status_idx").on(table.status),
    index("employees_is_driver_idx").on(table.isDriver),
    index("employees_contractor_company_id_idx").on(
      table.contractorCompanyId,
    ),
  ],
);

// ── Licences (driver-specific) ──

export const licences = pgTable(
  "licences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    licenceClass: varchar("licence_class", { length: 5 }).notNull(),
    licenceNumber: varchar("licence_number", { length: 50 }).notNull(),
    stateOfIssue: varchar("state_of_issue", { length: 3 }).notNull(),
    expiryDate: varchar("expiry_date", { length: 10 }).notNull(),
    conditions: text("conditions"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("licences_employee_id_idx").on(table.employeeId)],
);

// ── Medical Certificates (driver-specific) ──

export const medicals = pgTable(
  "medicals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    certificateNumber: varchar("certificate_number", { length: 100 }),
    issuedDate: varchar("issued_date", { length: 10 }).notNull(),
    expiryDate: varchar("expiry_date", { length: 10 }).notNull(),
    conditions: text("conditions"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("medicals_employee_id_idx").on(table.employeeId)],
);

// ── Qualification Types (tenant-configurable) ──

export const qualificationTypes = pgTable("qualification_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  hasExpiry: boolean("has_expiry").notNull().default(true),
  requiresEvidence: boolean("requires_evidence").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Qualifications (employee has qualification) ──

export const qualifications = pgTable(
  "qualifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    qualificationTypeId: uuid("qualification_type_id")
      .notNull()
      .references(() => qualificationTypes.id),
    referenceNumber: varchar("reference_number", { length: 100 }),
    stateOfIssue: varchar("state_of_issue", { length: 3 }),
    issuedDate: varchar("issued_date", { length: 10 }),
    expiryDate: varchar("expiry_date", { length: 10 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("qualifications_employee_id_idx").on(table.employeeId),
    index("qualifications_type_id_idx").on(table.qualificationTypeId),
  ],
);

// ── Asset Categories (tenant-configurable) ──

export const assetCategories = pgTable("asset_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // truck, trailer, equipment, tool
  industryType: varchar("industry_type", { length: 20 }).notNull().default("transport"),
  enableSpecifications: boolean("enable_specifications").notNull().default(true),
  enableWeightSpecs: boolean("enable_weight_specs").notNull().default(false),
  enableMassScheme: boolean("enable_mass_scheme").notNull().default(false),
  enableEngineHours: boolean("enable_engine_hours").notNull().default(false),
  enableCapacityFields: boolean("enable_capacity_fields").notNull().default(false),
  enableRegistration: boolean("enable_registration").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// ── Asset Subcategories ──

export const assetSubcategories = pgTable(
  "asset_subcategories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => assetCategories.id),
    name: varchar("name", { length: 100 }).notNull(),
    vehicleConfiguration: varchar("vehicle_configuration", { length: 100 }),
    defaultVolume: numeric("default_volume", { precision: 10, scale: 2 }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("asset_subcategories_category_id_idx").on(table.categoryId),
  ],
);

// ── Assets ──

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetNumber: varchar("asset_number", { length: 50 }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => assetCategories.id),
    subcategoryId: uuid("subcategory_id").references(
      () => assetSubcategories.id,
    ),
    ownership: varchar("ownership", { length: 20 }).notNull().default("tenant"),
    contractorCompanyId: uuid("contractor_company_id").references(
      () => companies.id,
    ),
    status: varchar("status", { length: 20 }).notNull().default("available"),

    // Registration
    registrationNumber: varchar("registration_number", { length: 20 }),
    registrationState: varchar("registration_state", { length: 3 }),
    registrationExpiry: varchar("registration_expiry", { length: 10 }),

    // Make/model
    make: varchar("make", { length: 100 }),
    model: varchar("model", { length: 100 }),
    year: integer("year"),
    vin: varchar("vin", { length: 50 }),

    // Weight specs
    tareWeight: numeric("tare_weight", { precision: 10, scale: 2 }),
    gvm: numeric("gvm", { precision: 10, scale: 2 }),
    gcm: numeric("gcm", { precision: 10, scale: 2 }),
    vehicleConfiguration: varchar("vehicle_configuration", { length: 100 }),
    massScheme: varchar("mass_scheme", { length: 50 }),

    // Body configuration
    bodyMaterial: varchar("body_material", { length: 100 }),
    sideHeight: numeric("side_height", { precision: 6, scale: 2 }),
    bodyType: varchar("body_type", { length: 100 }),

    // Equipment fitted
    equipmentFitted: jsonb("equipment_fitted").$type<{
      scales: boolean;
      mudLocks: boolean;
      fireExtinguisher: boolean;
      firstAid: boolean;
      uhfRadio: boolean;
      gpsTracking: boolean;
      isolationSwitch: boolean;
    }>(),

    // Capacity
    capacity: numeric("capacity", { precision: 10, scale: 2 }),
    capacityUnit: varchar("capacity_unit", { length: 20 }),

    // Tracking
    engineHours: numeric("engine_hours", { precision: 10, scale: 1 }),
    engineHoursDate: varchar("engine_hours_date", { length: 10 }),
    odometer: numeric("odometer", { precision: 10, scale: 0 }),
    odometerDate: varchar("odometer_date", { length: 10 }),

    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("assets_category_id_idx").on(table.categoryId),
    index("assets_subcategory_id_idx").on(table.subcategoryId),
    index("assets_status_idx").on(table.status),
    index("assets_ownership_idx").on(table.ownership),
    index("assets_contractor_company_id_idx").on(table.contractorCompanyId),
    index("assets_registration_number_idx").on(table.registrationNumber),
  ],
);

// ── Default Pairings (truck-trailer) ──

export const defaultPairings = pgTable(
  "default_pairings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    truckId: uuid("truck_id")
      .notNull()
      .references(() => assets.id),
    trailerId: uuid("trailer_id")
      .notNull()
      .references(() => assets.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("default_pairings_truck_id_idx").on(table.truckId),
    index("default_pairings_trailer_id_idx").on(table.trailerId),
  ],
);

// ── Material Categories (two-level hierarchy) ──

export const materialCategories = pgTable("material_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 30 }).notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const materialSubcategories = pgTable(
  "material_subcategories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => materialCategories.id),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    densityFactor: numeric("density_factor", { precision: 8, scale: 4 }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("material_subcategories_category_id_idx").on(table.categoryId),
  ],
);

// ── Tenant Materials (own stockpile) ──

export const tenantMaterials = pgTable(
  "tenant_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    subcategoryId: uuid("subcategory_id").references(
      () => materialSubcategories.id,
    ),
    unitOfMeasure: varchar("unit_of_measure", { length: 20 }).notNull(),
    addressId: uuid("address_id").references(() => addresses.id),
    description: text("description"),
    densityFactor: numeric("density_factor", { precision: 8, scale: 4 }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    compliance: jsonb("compliance").$type<{
      isHazardous: boolean;
      isRegulatedWaste: boolean;
      isDangerousGoods: boolean;
      requiresTracking: boolean;
      requiresAuthority: boolean;
      unNumber?: string;
      dgClass?: string;
      packingGroup?: string;
      wasteCode?: string;
      epaCategory?: string;
    }>(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("tenant_materials_subcategory_id_idx").on(table.subcategoryId),
    index("tenant_materials_address_id_idx").on(table.addressId),
    index("tenant_materials_status_idx").on(table.status),
  ],
);

// ── Supplier Materials (buy-side) ──

export const supplierMaterials = pgTable(
  "supplier_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => companies.id),
    supplierName: varchar("supplier_name", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    subcategoryId: uuid("subcategory_id").references(
      () => materialSubcategories.id,
    ),
    unitOfMeasure: varchar("unit_of_measure", { length: 20 }).notNull(),
    addressId: uuid("address_id").references(() => addresses.id),
    supplierProductCode: varchar("supplier_product_code", { length: 50 }),
    purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }),
    minimumOrderQty: numeric("minimum_order_qty", { precision: 12, scale: 2 }),
    description: text("description"),
    densityFactor: numeric("density_factor", { precision: 8, scale: 4 }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    compliance: jsonb("compliance").$type<{
      isHazardous: boolean;
      isRegulatedWaste: boolean;
      isDangerousGoods: boolean;
      requiresTracking: boolean;
      requiresAuthority: boolean;
      unNumber?: string;
      dgClass?: string;
      packingGroup?: string;
      wasteCode?: string;
      epaCategory?: string;
    }>(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("supplier_materials_supplier_id_idx").on(table.supplierId),
    index("supplier_materials_subcategory_id_idx").on(table.subcategoryId),
    index("supplier_materials_address_id_idx").on(table.addressId),
    index("supplier_materials_status_idx").on(table.status),
  ],
);

// ── Customer Materials (sell-side) ──

export const customerMaterials = pgTable(
  "customer_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => companies.id),
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    subcategoryId: uuid("subcategory_id").references(
      () => materialSubcategories.id,
    ),
    unitOfMeasure: varchar("unit_of_measure", { length: 20 }).notNull(),
    addressId: uuid("address_id").references(() => addresses.id),
    salePrice: numeric("sale_price", { precision: 12, scale: 2 }),
    description: text("description"),
    densityFactor: numeric("density_factor", { precision: 8, scale: 4 }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    compliance: jsonb("compliance").$type<{
      isHazardous: boolean;
      isRegulatedWaste: boolean;
      isDangerousGoods: boolean;
      requiresTracking: boolean;
      requiresAuthority: boolean;
      unNumber?: string;
      dgClass?: string;
      packingGroup?: string;
      wasteCode?: string;
      epaCategory?: string;
    }>(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("customer_materials_customer_id_idx").on(table.customerId),
    index("customer_materials_subcategory_id_idx").on(table.subcategoryId),
    index("customer_materials_address_id_idx").on(table.addressId),
    index("customer_materials_status_idx").on(table.status),
  ],
);

// ── Disposal Materials (accept/supply at disposal sites) ──

export const disposalMaterials = pgTable(
  "disposal_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    addressId: uuid("address_id")
      .notNull()
      .references(() => addresses.id),
    name: varchar("name", { length: 255 }).notNull(),
    subcategoryId: uuid("subcategory_id").references(
      () => materialSubcategories.id,
    ),
    unitOfMeasure: varchar("unit_of_measure", { length: 20 }).notNull(),
    materialMode: varchar("material_mode", { length: 10 }).notNull(),
    tipFee: numeric("tip_fee", { precision: 12, scale: 2 }),
    environmentalLevy: numeric("environmental_levy", { precision: 12, scale: 2 }),
    minimumCharge: numeric("minimum_charge", { precision: 12, scale: 2 }),
    salePrice: numeric("sale_price", { precision: 12, scale: 2 }),
    description: text("description"),
    densityFactor: numeric("density_factor", { precision: 8, scale: 4 }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    compliance: jsonb("compliance").$type<{
      isHazardous: boolean;
      isRegulatedWaste: boolean;
      isDangerousGoods: boolean;
      requiresTracking: boolean;
      requiresAuthority: boolean;
      unNumber?: string;
      dgClass?: string;
      packingGroup?: string;
      wasteCode?: string;
      epaCategory?: string;
    }>(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("disposal_materials_address_id_idx").on(table.addressId),
    index("disposal_materials_subcategory_id_idx").on(table.subcategoryId),
    index("disposal_materials_material_mode_idx").on(table.materialMode),
    index("disposal_materials_status_idx").on(table.status),
  ],
);

// ── Disposal Site Settings ──

export const disposalSiteSettings = pgTable(
  "disposal_site_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    addressId: uuid("address_id")
      .notNull()
      .references(() => addresses.id),
    operatingHours: text("operating_hours"),
    acceptedMaterials: text("accepted_materials"),
    rejectedMaterials: text("rejected_materials"),
    epaLicenceNumber: varchar("epa_licence_number", { length: 100 }),
    epaLicenceExpiry: varchar("epa_licence_expiry", { length: 10 }),
    wasteCodes: text("waste_codes"),
    accountTerms: text("account_terms"),
    creditLimit: numeric("credit_limit", { precision: 12, scale: 2 }),
    preApprovalRequired: boolean("pre_approval_required").notNull().default(false),
    accountsContactName: varchar("accounts_contact_name", { length: 255 }),
    accountsContactPhone: varchar("accounts_contact_phone", { length: 20 }),
    accountsContactEmail: varchar("accounts_contact_email", { length: 255 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("disposal_site_settings_address_id_idx").on(table.addressId),
  ],
);

// ── Job Types (tenant-configurable) ──

export const jobTypes = pgTable("job_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 20 }).notNull(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  visibleSections: jsonb("visible_sections").$type<{
    locations: boolean;
    materials: boolean;
    assetRequirements: boolean;
    pricing: boolean;
    scheduling: boolean;
  }>(),
  requiredFields: jsonb("required_fields").$type<{
    poNumber: boolean;
    materials: boolean;
    locations: boolean;
  }>(),
  availablePricingMethods: jsonb("available_pricing_methods").$type<string[]>(),
  defaults: jsonb("defaults").$type<{
    priority?: string;
    durationHours?: number;
    assetCategoryId?: string;
  }>(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// ── Projects (optional job grouping) ──

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectNumber: varchar("project_number", { length: 20 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    customerId: uuid("customer_id").references(() => companies.id),
    startDate: varchar("start_date", { length: 10 }),
    endDate: varchar("end_date", { length: 10 }),
    salesRepId: uuid("sales_rep_id").references(() => employees.id),
    projectLeadId: uuid("project_lead_id").references(() => employees.id),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("projects_customer_id_idx").on(table.customerId),
    index("projects_status_idx").on(table.status),
  ],
);

// ── Jobs ──

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobNumber: varchar("job_number", { length: 20 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    jobTypeId: uuid("job_type_id")
      .notNull()
      .references(() => jobTypes.id),
    customerId: uuid("customer_id").references(() => companies.id),
    projectId: uuid("project_id").references(() => projects.id),
    poNumber: varchar("po_number", { length: 100 }),
    priority: varchar("priority", { length: 10 }).notNull().default("medium"),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    salesRepId: uuid("sales_rep_id").references(() => employees.id),
    jobLeadId: uuid("job_lead_id").references(() => employees.id),
    scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
    scheduledEnd: timestamp("scheduled_end", { withTimezone: true }),
    actualStart: timestamp("actual_start", { withTimezone: true }),
    actualEnd: timestamp("actual_end", { withTimezone: true }),
    isMultiDay: boolean("is_multi_day").notNull().default(false),
    minimumChargeHours: numeric("minimum_charge_hours", { precision: 6, scale: 2 }),
    overtimeRate: numeric("overtime_rate", { precision: 12, scale: 4 }),
    overtimeThresholdHours: numeric("overtime_threshold_hours", { precision: 6, scale: 2 }),
    externalNotes: text("external_notes"),
    internalNotes: text("internal_notes"),
    cancellationReason: text("cancellation_reason"),
    metadata: jsonb("metadata"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("jobs_job_type_id_idx").on(table.jobTypeId),
    index("jobs_customer_id_idx").on(table.customerId),
    index("jobs_project_id_idx").on(table.projectId),
    index("jobs_status_idx").on(table.status),
    index("jobs_priority_idx").on(table.priority),
    index("jobs_scheduled_start_idx").on(table.scheduledStart),
  ],
);

// ── Job Locations ──

export const jobLocations = pgTable(
  "job_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    locationType: varchar("location_type", { length: 10 }).notNull(),
    addressId: uuid("address_id")
      .notNull()
      .references(() => addresses.id),
    entryPointId: uuid("entry_point_id").references(() => entryPoints.id),
    sequence: integer("sequence").notNull().default(0),
    contactName: varchar("contact_name", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 20 }),
    instructions: text("instructions"),
    tipFee: numeric("tip_fee", { precision: 12, scale: 2 }),
    arrivalTime: timestamp("arrival_time", { withTimezone: true }),
    departureTime: timestamp("departure_time", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("job_locations_job_id_idx").on(table.jobId),
    index("job_locations_address_id_idx").on(table.addressId),
  ],
);

// ── Job Materials (snapshots) ──

export const jobMaterials = pgTable(
  "job_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    materialSourceType: varchar("material_source_type", { length: 20 }).notNull(),
    materialSourceId: uuid("material_source_id").notNull(),
    materialNameSnapshot: varchar("material_name_snapshot", { length: 255 }).notNull(),
    materialCategorySnapshot: varchar("material_category_snapshot", { length: 100 }),
    materialComplianceSnapshot: jsonb("material_compliance_snapshot").$type<{
      isHazardous: boolean;
      isRegulatedWaste: boolean;
      isDangerousGoods: boolean;
      requiresTracking: boolean;
      requiresAuthority: boolean;
      unNumber?: string;
      dgClass?: string;
      packingGroup?: string;
      wasteCode?: string;
      epaCategory?: string;
    }>(),
    quantity: numeric("quantity", { precision: 12, scale: 4 }),
    unitOfMeasure: varchar("unit_of_measure", { length: 20 }),
    flowType: varchar("flow_type", { length: 20 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("job_materials_job_id_idx").on(table.jobId),
  ],
);

// ── Job Asset Requirements ──

export const jobAssetRequirements = pgTable(
  "job_asset_requirements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    assetCategoryId: uuid("asset_category_id")
      .notNull()
      .references(() => assetCategories.id),
    assetSubcategoryId: uuid("asset_subcategory_id").references(
      () => assetSubcategories.id,
    ),
    quantity: integer("quantity").notNull().default(1),
    payloadLimit: numeric("payload_limit", { precision: 10, scale: 2 }),
    specialRequirements: text("special_requirements"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("job_asset_requirements_job_id_idx").on(table.jobId),
    index("job_asset_requirements_category_id_idx").on(table.assetCategoryId),
  ],
);

// ── Job Pricing Lines ──

export const jobPricingLines = pgTable(
  "job_pricing_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    lineType: varchar("line_type", { length: 10 }).notNull(),
    partyId: uuid("party_id").references(() => companies.id),
    partyName: varchar("party_name", { length: 255 }),
    category: varchar("category", { length: 20 }).notNull(),
    description: text("description"),
    rateType: varchar("rate_type", { length: 20 }).notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull().default("0"),
    unitRate: numeric("unit_rate", { precision: 12, scale: 4 }).notNull().default("0"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),
    plannedQuantity: numeric("planned_quantity", { precision: 12, scale: 4 }),
    plannedUnitRate: numeric("planned_unit_rate", { precision: 12, scale: 4 }),
    plannedTotal: numeric("planned_total", { precision: 14, scale: 2 }),
    isLocked: boolean("is_locked").notNull().default(false),
    isVariation: boolean("is_variation").notNull().default(false),
    variationReason: text("variation_reason"),
    source: varchar("source", { length: 20 }).notNull().default("manual"),
    sourceReferenceId: uuid("source_reference_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    // Credit support
    creditType: varchar("credit_type", { length: 20 }),
    originalLineId: uuid("original_line_id"),
    // Snapshot & immutability
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }),
    // Rate card tracing
    usedCustomerPricing: boolean("used_customer_pricing").notNull().default(false),
    rateCardEntryId: uuid("rate_card_entry_id"),
    // Automation tracing
    surchargeId: uuid("surcharge_id"),
    markupRuleId: uuid("markup_rule_id"),
    // Margin override
    marginOverrideReason: text("margin_override_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("job_pricing_lines_job_id_idx").on(table.jobId),
    index("job_pricing_lines_line_type_idx").on(table.lineType),
  ],
);

// ── Job Assignments (actual allocations of assets/drivers/contractors) ──

export const jobAssignments = pgTable(
  "job_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    assignmentType: varchar("assignment_type", { length: 20 }).notNull(), // asset, driver, contractor
    assetId: uuid("asset_id").references(() => assets.id),
    employeeId: uuid("employee_id").references(() => employees.id),
    contractorCompanyId: uuid("contractor_company_id").references(
      () => companies.id,
    ),
    requirementId: uuid("requirement_id").references(
      () => jobAssetRequirements.id,
    ),
    status: varchar("status", { length: 20 }).notNull().default("assigned"),
    plannedStart: timestamp("planned_start", { withTimezone: true }),
    plannedEnd: timestamp("planned_end", { withTimezone: true }),
    actualStart: timestamp("actual_start", { withTimezone: true }),
    actualEnd: timestamp("actual_end", { withTimezone: true }),
    notes: text("notes"),
    deallocationReason: varchar("deallocation_reason", { length: 30 }),
    completedLoads: integer("completed_loads"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("job_assignments_job_id_idx").on(table.jobId),
    index("job_assignments_asset_id_idx").on(table.assetId),
    index("job_assignments_employee_id_idx").on(table.employeeId),
    index("job_assignments_contractor_company_id_idx").on(
      table.contractorCompanyId,
    ),
    index("job_assignments_status_idx").on(table.status),
  ],
);

// ── Job Status History ──

export const jobStatusHistory = pgTable(
  "job_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    fromStatus: varchar("from_status", { length: 20 }),
    toStatus: varchar("to_status", { length: 20 }).notNull(),
    changedBy: text("changed_by").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("job_status_history_job_id_idx").on(table.jobId),
  ],
);

// ══════════════════════════════════════════════════════════════════
// ── Pricing Engine Tables ──
// ══════════════════════════════════════════════════════════════════

// ── Customer Rate Cards ──

export const customerRateCards = pgTable(
  "customer_rate_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => companies.id),
    name: varchar("name", { length: 255 }).notNull(),
    effectiveFrom: varchar("effective_from", { length: 10 }).notNull(),
    effectiveTo: varchar("effective_to", { length: 10 }),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("customer_rate_cards_customer_id_idx").on(table.customerId),
  ],
);

export const customerRateCardEntries = pgTable(
  "customer_rate_card_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rateCardId: uuid("rate_card_id")
      .notNull()
      .references(() => customerRateCards.id),
    materialSubcategoryId: uuid("material_subcategory_id").references(() => materialSubcategories.id),
    category: varchar("category", { length: 20 }).notNull(),
    rateType: varchar("rate_type", { length: 20 }).notNull(),
    unitRate: numeric("unit_rate", { precision: 12, scale: 4 }).notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("rate_card_entries_rate_card_id_idx").on(table.rateCardId),
    index("rate_card_entries_subcategory_idx").on(table.materialSubcategoryId),
  ],
);

// ── Pricing Allocations ──

export const pricingAllocations = pgTable(
  "pricing_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pricingLineId: uuid("pricing_line_id")
      .notNull()
      .references(() => jobPricingLines.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => companies.id),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    percentage: numeric("percentage", { precision: 8, scale: 4 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("pricing_allocations_line_id_idx").on(table.pricingLineId),
    index("pricing_allocations_customer_id_idx").on(table.customerId),
  ],
);

// ── Price History ──

export const priceHistory = pgTable(
  "price_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: varchar("entity_type", { length: 30 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    previousPrice: numeric("previous_price", { precision: 12, scale: 4 }),
    newPrice: numeric("new_price", { precision: 12, scale: 4 }).notNull(),
    effectiveDate: varchar("effective_date", { length: 10 }).notNull(),
    changeSource: varchar("change_source", { length: 20 }).notNull(),
    changedBy: text("changed_by").notNull(),
    bulkUpdateId: uuid("bulk_update_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("price_history_entity_idx").on(table.entityType, table.entityId),
    index("price_history_effective_date_idx").on(table.effectiveDate),
    index("price_history_bulk_update_id_idx").on(table.bulkUpdateId),
  ],
);

// ── Pricing Templates ──

export const pricingTemplates = pgTable(
  "pricing_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
);

export const pricingTemplateLines = pgTable(
  "pricing_template_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => pricingTemplates.id),
    lineType: varchar("line_type", { length: 10 }).notNull(),
    category: varchar("category", { length: 20 }).notNull(),
    description: text("description"),
    rateType: varchar("rate_type", { length: 20 }).notNull(),
    unitRate: numeric("unit_rate", { precision: 12, scale: 4 }),
    quantity: numeric("quantity", { precision: 12, scale: 4 }),
    partyId: uuid("party_id").references(() => companies.id),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("pricing_template_lines_template_id_idx").on(table.templateId),
  ],
);

// ── Surcharges ──

export const surcharges = pgTable(
  "surcharges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    value: numeric("value", { precision: 12, scale: 4 }).notNull(),
    appliesTo: jsonb("applies_to").$type<string[]>().notNull().default([]),
    autoApply: boolean("auto_apply").notNull().default(true),
    effectiveFrom: varchar("effective_from", { length: 10 }).notNull(),
    effectiveTo: varchar("effective_to", { length: 10 }),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
);

export const surchargeHistory = pgTable(
  "surcharge_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    surchargeId: uuid("surcharge_id")
      .notNull()
      .references(() => surcharges.id),
    previousValue: numeric("previous_value", { precision: 12, scale: 4 }).notNull(),
    newValue: numeric("new_value", { precision: 12, scale: 4 }).notNull(),
    effectiveDate: varchar("effective_date", { length: 10 }).notNull(),
    changedBy: text("changed_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("surcharge_history_surcharge_id_idx").on(table.surchargeId),
  ],
);

// ── Markup Rules ──

export const markupRules = pgTable(
  "markup_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    markupPercentage: numeric("markup_percentage", { precision: 8, scale: 4 }),
    markupFixedAmount: numeric("markup_fixed_amount", { precision: 12, scale: 4 }),
    materialCategoryId: uuid("material_category_id").references(() => materialCategories.id),
    supplierId: uuid("supplier_id").references(() => companies.id),
    priority: integer("priority").notNull().default(100),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("markup_rules_priority_idx").on(table.priority),
    index("markup_rules_material_category_idx").on(table.materialCategoryId),
    index("markup_rules_supplier_idx").on(table.supplierId),
  ],
);

// ── Margin Thresholds ──

export const marginThresholds = pgTable(
  "margin_thresholds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    level: varchar("level", { length: 20 }).notNull(),
    referenceId: uuid("reference_id"),
    minimumMarginPercent: numeric("minimum_margin_percent", { precision: 8, scale: 4 }).notNull(),
    warningMarginPercent: numeric("warning_margin_percent", { precision: 8, scale: 4 }).notNull(),
    requiresApproval: boolean("requires_approval").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("margin_thresholds_level_idx").on(table.level, table.referenceId),
  ],
);

// ══════════════════════════════════════════════════════════════════
// ── Dockets & Daysheets Tables (doc 08) ──
// ══════════════════════════════════════════════════════════════════

// ── Daysheets (primary work record) ──

export const daysheets = pgTable(
  "daysheets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    assignmentId: uuid("assignment_id").references(() => jobAssignments.id),
    driverId: uuid("driver_id").references(() => employees.id),
    assetId: uuid("asset_id").references(() => assets.id),
    workDate: varchar("work_date", { length: 10 }).notNull(),
    submissionChannel: varchar("submission_channel", { length: 20 }).notNull().default("staff_entry"),
    status: varchar("status", { length: 20 }).notNull().default("submitted"),
    // Tonnage work
    loadCount: integer("load_count"),
    totalQuantity: numeric("total_quantity", { precision: 12, scale: 4 }),
    totalGrossWeight: numeric("total_gross_weight", { precision: 12, scale: 4 }),
    totalTareWeight: numeric("total_tare_weight", { precision: 12, scale: 4 }),
    totalNetWeight: numeric("total_net_weight", { precision: 12, scale: 4 }),
    // Hourly work
    startTime: varchar("start_time", { length: 5 }),
    endTime: varchar("end_time", { length: 5 }),
    hoursWorked: numeric("hours_worked", { precision: 6, scale: 2 }),
    overtimeHours: numeric("overtime_hours", { precision: 6, scale: 2 }),
    breakMinutes: integer("break_minutes"),
    totalBillableHours: numeric("total_billable_hours", { precision: 6, scale: 2 }),
    // Locations
    pickupLocationId: uuid("pickup_location_id").references(() => jobLocations.id),
    deliveryLocationId: uuid("delivery_location_id").references(() => jobLocations.id),
    // Processing metadata
    isAutoProcessed: boolean("is_auto_processed").notNull().default(false),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processedBy: text("processed_by"),
    rejectionReason: text("rejection_reason"),
    // Notes
    notes: text("notes"),
    internalNotes: text("internal_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("daysheets_job_id_idx").on(table.jobId),
    index("daysheets_driver_id_idx").on(table.driverId),
    index("daysheets_asset_id_idx").on(table.assetId),
    index("daysheets_work_date_idx").on(table.workDate),
    index("daysheets_status_idx").on(table.status),
    index("daysheets_assignment_id_idx").on(table.assignmentId),
  ],
);

// ── Daysheet Loads (individual loads within a daysheet) ──

export const daysheetLoads = pgTable(
  "daysheet_loads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    daysheetId: uuid("daysheet_id")
      .notNull()
      .references(() => daysheets.id),
    loadNumber: integer("load_number").notNull(),
    materialSourceType: varchar("material_source_type", { length: 20 }),
    materialSourceId: uuid("material_source_id"),
    materialName: varchar("material_name", { length: 255 }),
    unitOfMeasure: varchar("unit_of_measure", { length: 20 }),
    quantity: numeric("quantity", { precision: 12, scale: 4 }),
    grossWeight: numeric("gross_weight", { precision: 12, scale: 4 }),
    tareWeight: numeric("tare_weight", { precision: 12, scale: 4 }),
    netWeight: numeric("net_weight", { precision: 12, scale: 4 }),
    docketNumber: varchar("docket_number", { length: 100 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("daysheet_loads_daysheet_id_idx").on(table.daysheetId),
  ],
);

// ── Dockets (external supporting documents) ──

export const dockets = pgTable(
  "dockets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    daysheetId: uuid("daysheet_id").references(() => daysheets.id),
    docketType: varchar("docket_type", { length: 30 }).notNull(),
    docketNumber: varchar("docket_number", { length: 100 }),
    status: varchar("status", { length: 20 }).notNull().default("uploaded"),
    issuerName: varchar("issuer_name", { length: 255 }),
    issueDate: varchar("issue_date", { length: 10 }),
    // Extracted data
    materialName: varchar("material_name", { length: 255 }),
    quantity: numeric("quantity", { precision: 12, scale: 4 }),
    unitOfMeasure: varchar("unit_of_measure", { length: 20 }),
    grossWeight: numeric("gross_weight", { precision: 12, scale: 4 }),
    tareWeight: numeric("tare_weight", { precision: 12, scale: 4 }),
    netWeight: numeric("net_weight", { precision: 12, scale: 4 }),
    tipFee: numeric("tip_fee", { precision: 12, scale: 2 }),
    environmentalLevy: numeric("environmental_levy", { precision: 12, scale: 2 }),
    // AI processing
    aiConfidence: jsonb("ai_confidence").$type<Record<string, number>>(),
    aiProcessed: boolean("ai_processed").notNull().default(false),
    // Reconciliation
    hasDiscrepancy: boolean("has_discrepancy").notNull().default(false),
    discrepancyNotes: text("discrepancy_notes"),
    // Notes
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("dockets_job_id_idx").on(table.jobId),
    index("dockets_daysheet_id_idx").on(table.daysheetId),
    index("dockets_status_idx").on(table.status),
    index("dockets_docket_type_idx").on(table.docketType),
  ],
);

// ── Docket Files (uploaded images/documents) ──

export const docketFiles = pgTable(
  "docket_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    docketId: uuid("docket_id")
      .notNull()
      .references(() => dockets.id),
    fileName: varchar("file_name", { length: 500 }).notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    storageKey: text("storage_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("docket_files_docket_id_idx").on(table.docketId),
  ],
);

// ── Charges (created from daysheet processing) ──

export const charges = pgTable(
  "charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    daysheetId: uuid("daysheet_id")
      .notNull()
      .references(() => daysheets.id),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    pricingLineId: uuid("pricing_line_id").references(() => jobPricingLines.id),
    lineType: varchar("line_type", { length: 10 }).notNull(),
    partyId: uuid("party_id").references(() => companies.id),
    partyName: varchar("party_name", { length: 255 }),
    category: varchar("category", { length: 20 }).notNull(),
    description: text("description"),
    rateType: varchar("rate_type", { length: 20 }).notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull().default("0"),
    unitRate: numeric("unit_rate", { precision: 12, scale: 4 }).notNull().default("0"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    isOverride: boolean("is_override").notNull().default(false),
    overrideReason: text("override_reason"),
    invoiceId: uuid("invoice_id"),
    rctiId: uuid("rcti_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("charges_daysheet_id_idx").on(table.daysheetId),
    index("charges_job_id_idx").on(table.jobId),
    index("charges_pricing_line_id_idx").on(table.pricingLineId),
    index("charges_status_idx").on(table.status),
    index("charges_invoice_id_idx").on(table.invoiceId),
    index("charges_rcti_id_idx").on(table.rctiId),
  ],
);

// ── Overages (detected during processing) ──

export const overages = pgTable(
  "overages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    daysheetId: uuid("daysheet_id")
      .notNull()
      .references(() => daysheets.id),
    daysheetLoadId: uuid("daysheet_load_id").references(() => daysheetLoads.id),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    overageType: varchar("overage_type", { length: 20 }).notNull(),
    severity: varchar("severity", { length: 20 }).notNull(),
    actualValue: numeric("actual_value", { precision: 12, scale: 4 }).notNull(),
    limitValue: numeric("limit_value", { precision: 12, scale: 4 }).notNull(),
    overageAmount: numeric("overage_amount", { precision: 12, scale: 4 }).notNull(),
    overagePercent: numeric("overage_percent", { precision: 8, scale: 4 }).notNull(),
    approvalStatus: varchar("approval_status", { length: 20 }).notNull().default("pending"),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvalNotes: text("approval_notes"),
    // Context
    driverId: uuid("driver_id").references(() => employees.id),
    assetId: uuid("asset_id").references(() => assets.id),
    materialName: varchar("material_name", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("overages_daysheet_id_idx").on(table.daysheetId),
    index("overages_job_id_idx").on(table.jobId),
    index("overages_approval_status_idx").on(table.approvalStatus),
    index("overages_driver_id_idx").on(table.driverId),
    index("overages_asset_id_idx").on(table.assetId),
  ],
);

// ══════════════════════════════════════════════════════════════════
// ── Invoicing & RCTI Tables (doc 10) ──
// ══════════════════════════════════════════════════════════════════

// ── Invoice Sequences (configurable number generation) ──

export const invoiceSequences = pgTable("invoice_sequences", {
  id: uuid("id").primaryKey().defaultRandom(),
  sequenceType: varchar("sequence_type", { length: 20 }).notNull(),
  prefix: varchar("prefix", { length: 20 }),
  suffix: varchar("suffix", { length: 20 }),
  nextNumber: integer("next_number").notNull().default(1),
  minDigits: integer("min_digits").notNull().default(4),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Customer Invoice Settings (per-customer invoicing preferences) ──

export const customerInvoiceSettings = pgTable(
  "customer_invoice_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id)
      .unique(),
    invoiceSchedule: varchar("invoice_schedule", { length: 20 }).notNull().default("on_completion"),
    invoiceGrouping: varchar("invoice_grouping", { length: 20 }).notNull().default("per_job"),
    scheduleDayOfWeek: integer("schedule_day_of_week"),
    scheduleDayOfMonth: integer("schedule_day_of_month"),
    paymentTermsDays: integer("payment_terms_days").notNull().default(30),
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }),
    creditWarningPercent: integer("credit_warning_percent").notNull().default(80),
    creditStop: boolean("credit_stop").notNull().default(false),
    creditStopReason: text("credit_stop_reason"),
    creditStopBy: text("credit_stop_by"),
    creditStopAt: timestamp("credit_stop_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("customer_invoice_settings_company_id_idx").on(table.companyId),
  ],
);

// ── Contractor Payment Settings (per-contractor RCTI preferences) ──

export const contractorPaymentSettings = pgTable(
  "contractor_payment_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id)
      .unique(),
    paymentFrequency: varchar("payment_frequency", { length: 20 }).notNull().default("weekly"),
    paymentDay1: integer("payment_day_1"),
    paymentDay2: integer("payment_day_2"),
    cutoffTime: varchar("cutoff_time", { length: 5 }).notNull().default("17:00"),
    paymentTermsDays: integer("payment_terms_days").notNull().default(7),
    gstInclusive: boolean("gst_inclusive").notNull().default(false),
    requireApproval: boolean("require_approval").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("contractor_payment_settings_company_id_idx").on(table.companyId),
  ],
);

// ── Invoices ──

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => companies.id),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    issueDate: varchar("issue_date", { length: 10 }).notNull(),
    dueDate: varchar("due_date", { length: 10 }).notNull(),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }).notNull().default("0"),
    groupReference: uuid("group_reference"),
    groupingMode: varchar("grouping_mode", { length: 20 }),
    projectId: uuid("project_id").references(() => projects.id),
    poNumber: varchar("po_number", { length: 100 }),
    notes: text("notes"),
    internalNotes: text("internal_notes"),
    // Verification
    verifiedBy: text("verified_by"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verificationNotes: text("verification_notes"),
    // Rejection
    rejectedBy: text("rejected_by"),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    // Sending
    sentAt: timestamp("sent_at", { withTimezone: true }),
    sentBy: text("sent_by"),
    // Payment
    paidAt: timestamp("paid_at", { withTimezone: true }),
    // Cancellation
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: text("cancelled_by"),
    cancellationReason: text("cancellation_reason"),
    // Xero integration
    xeroInvoiceId: varchar("xero_invoice_id", { length: 100 }),
    // PDF & billing run
    pdfDocumentId: uuid("pdf_document_id"),
    billingRunId: uuid("billing_run_id"),
    // Snapshot
    pricingSnapshot: jsonb("pricing_snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("invoices_customer_id_idx").on(table.customerId),
    index("invoices_status_idx").on(table.status),
    index("invoices_issue_date_idx").on(table.issueDate),
    index("invoices_due_date_idx").on(table.dueDate),
    index("invoices_created_at_idx").on(table.createdAt),
  ],
);

// ── Invoice Line Items ──

export const invoiceLineItems = pgTable(
  "invoice_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id),
    lineNumber: integer("line_number").notNull(),
    chargeId: uuid("charge_id").references(() => charges.id),
    jobId: uuid("job_id").references(() => jobs.id),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull(),
    unitOfMeasure: varchar("unit_of_measure", { length: 20 }),
    unitPrice: numeric("unit_price", { precision: 12, scale: 4 }).notNull(),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
    accountCode: varchar("account_code", { length: 20 }),
    pricingSnapshot: jsonb("pricing_snapshot"),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }),
    calculationMethod: text("calculation_method"),
    sourceJobNumber: varchar("source_job_number", { length: 20 }),
    sourceDocketNumber: varchar("source_docket_number", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("invoice_line_items_invoice_id_idx").on(table.invoiceId),
    index("invoice_line_items_charge_id_idx").on(table.chargeId),
  ],
);

// ── RCTI Batches ──

export const rctiBatches = pgTable("rcti_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchNumber: varchar("batch_number", { length: 50 }).notNull(),
  periodStart: varchar("period_start", { length: 10 }).notNull(),
  periodEnd: varchar("period_end", { length: 10 }).notNull(),
  contractorCount: integer("contractor_count").notNull().default(0),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  generatedBy: text("generated_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── RCTIs (Recipient Created Tax Invoices) ──

export const rctis = pgTable(
  "rctis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rctiNumber: varchar("rcti_number", { length: 50 }).notNull().unique(),
    contractorId: uuid("contractor_id")
      .notNull()
      .references(() => companies.id),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    periodStart: varchar("period_start", { length: 10 }).notNull(),
    periodEnd: varchar("period_end", { length: 10 }).notNull(),
    issueDate: varchar("issue_date", { length: 10 }),
    dueDate: varchar("due_date", { length: 10 }),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    deductionsTotal: numeric("deductions_total", { precision: 14, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }).notNull().default("0"),
    batchId: uuid("batch_id").references(() => rctiBatches.id),
    notes: text("notes"),
    internalNotes: text("internal_notes"),
    // Approval
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvalNotes: text("approval_notes"),
    // Sending
    sentAt: timestamp("sent_at", { withTimezone: true }),
    sentBy: text("sent_by"),
    // Payment
    paidAt: timestamp("paid_at", { withTimezone: true }),
    // Cancellation
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: text("cancelled_by"),
    cancellationReason: text("cancellation_reason"),
    // Dispute
    disputedAt: timestamp("disputed_at", { withTimezone: true }),
    disputeReason: text("dispute_reason"),
    // Remittance
    remittanceEmailedAt: timestamp("remittance_emailed_at", { withTimezone: true }),
    // PDF documents
    pdfDocumentId: uuid("pdf_document_id"),
    remittancePdfDocumentId: uuid("remittance_pdf_document_id"),
    // Xero integration
    xeroBillId: varchar("xero_bill_id", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("rctis_contractor_id_idx").on(table.contractorId),
    index("rctis_status_idx").on(table.status),
    index("rctis_period_start_idx").on(table.periodStart),
    index("rctis_period_end_idx").on(table.periodEnd),
    index("rctis_batch_id_idx").on(table.batchId),
    index("rctis_created_at_idx").on(table.createdAt),
  ],
);

// ── RCTI Line Items ──

export const rctiLineItems = pgTable(
  "rcti_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rctiId: uuid("rcti_id")
      .notNull()
      .references(() => rctis.id),
    lineNumber: integer("line_number").notNull(),
    lineType: varchar("line_type", { length: 20 }).notNull().default("charge"),
    chargeId: uuid("charge_id").references(() => charges.id),
    jobId: uuid("job_id").references(() => jobs.id),
    daysheetId: uuid("daysheet_id").references(() => daysheets.id),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull(),
    unitOfMeasure: varchar("unit_of_measure", { length: 20 }),
    unitPrice: numeric("unit_price", { precision: 12, scale: 4 }).notNull(),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
    deductionCategory: varchar("deduction_category", { length: 30 }),
    deductionDetails: text("deduction_details"),
    assetRegistration: varchar("asset_registration", { length: 20 }),
    materialName: varchar("material_name", { length: 255 }),
    sourceJobNumber: varchar("source_job_number", { length: 20 }),
    sourceDocketNumber: varchar("source_docket_number", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("rcti_line_items_rcti_id_idx").on(table.rctiId),
    index("rcti_line_items_charge_id_idx").on(table.chargeId),
  ],
);

// ── Payments (for invoices and RCTIs) ──

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id").references(() => invoices.id),
    rctiId: uuid("rcti_id").references(() => rctis.id),
    paymentDate: varchar("payment_date", { length: 10 }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    paymentMethod: varchar("payment_method", { length: 20 }).notNull(),
    referenceNumber: varchar("reference_number", { length: 100 }),
    xeroPaymentId: varchar("xero_payment_id", { length: 100 }),
    notes: text("notes"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payments_invoice_id_idx").on(table.invoiceId),
    index("payments_rcti_id_idx").on(table.rctiId),
    index("payments_payment_date_idx").on(table.paymentDate),
  ],
);

// ── Credit Transactions ──

export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    transactionType: varchar("transaction_type", { length: 30 }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    referenceId: uuid("reference_id"),
    referenceType: varchar("reference_type", { length: 20 }),
    description: text("description"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("credit_transactions_company_id_idx").on(table.companyId),
    index("credit_transactions_type_idx").on(table.transactionType),
  ],
);

// ── AR Approvals (job approval for invoicing) ──

export const arApprovals = pgTable(
  "ar_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id)
      .unique(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedBy: text("rejected_by"),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectionNotes: text("rejection_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ar_approvals_job_id_idx").on(table.jobId),
    index("ar_approvals_status_idx").on(table.status),
  ],
);

// ══════════════════════════════════════════════════════════════════
// ── Document Management Tables (doc 15) ──
// ══════════════════════════════════════════════════════════════════

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: varchar("entity_type", { length: 20 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    documentType: varchar("document_type", { length: 30 }).notNull(),
    fileName: varchar("file_name", { length: 500 }).notNull(),
    originalFileName: varchar("original_file_name", { length: 500 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    fileSize: integer("file_size").notNull(),
    s3Key: text("s3_key").notNull(),
    s3Bucket: varchar("s3_bucket", { length: 100 }).notNull(),
    checksum: varchar("checksum", { length: 64 }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    storageTier: varchar("storage_tier", { length: 10 }).notNull().default("hot"),
    currentVersion: integer("current_version").notNull().default(1),
    issueDate: varchar("issue_date", { length: 10 }),
    expiryDate: varchar("expiry_date", { length: 10 }),
    metadata: jsonb("metadata"),
    notes: text("notes"),
    uploadedBy: text("uploaded_by").notNull(),
    uploadSource: varchar("upload_source", { length: 20 }).notNull().default("direct"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("documents_entity_idx").on(table.entityType, table.entityId),
    index("documents_type_idx").on(table.documentType),
    index("documents_status_idx").on(table.status),
    index("documents_expiry_date_idx").on(table.expiryDate),
    index("documents_created_at_idx").on(table.createdAt),
  ],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => documents.id),
    versionNumber: integer("version_number").notNull(),
    fileName: varchar("file_name", { length: 500 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    fileSize: integer("file_size").notNull(),
    s3Key: text("s3_key").notNull(),
    checksum: varchar("checksum", { length: 64 }),
    isCurrent: boolean("is_current").notNull().default(false),
    uploadedBy: text("uploaded_by").notNull(),
    uploadReason: text("upload_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("document_versions_document_id_idx").on(table.documentId),
  ],
);

export const publicDocumentLinks = pgTable(
  "public_document_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => documents.id),
    token: varchar("token", { length: 64 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    maxDownloads: integer("max_downloads"),
    downloadCount: integer("download_count").notNull().default(0),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("public_document_links_token_idx").on(table.token),
    index("public_document_links_document_id_idx").on(table.documentId),
  ],
);

export const documentAccessLog = pgTable(
  "document_access_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => documents.id),
    accessMethod: varchar("access_method", { length: 20 }).notNull(),
    action: varchar("action", { length: 20 }).notNull(),
    userId: text("user_id"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    publicLinkId: uuid("public_link_id").references(() => publicDocumentLinks.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("document_access_log_document_id_idx").on(table.documentId),
    index("document_access_log_created_at_idx").on(table.createdAt),
  ],
);

// ══════════════════════════════════════════════════════════════════
// ── Communications Tables (doc 13) ──
// ══════════════════════════════════════════════════════════════════

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    communicationType: varchar("communication_type", { length: 50 }).notNull(),
    category: varchar("category", { length: 30 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").notNull(),
    actionUrl: text("action_url"),
    actionLabel: varchar("action_label", { length: 100 }),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),
    status: varchar("status", { length: 20 }).notNull().default("unread"),
    readAt: timestamp("read_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),
    index("notifications_status_idx").on(table.userId, table.status),
    index("notifications_created_at_idx").on(table.createdAt),
    index("notifications_category_idx").on(table.category),
  ],
);

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  globalEnabled: boolean("global_enabled").notNull().default(true),
  pushEnabled: boolean("push_enabled").notNull().default(true),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  smsEnabled: boolean("sms_enabled").notNull().default(true),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  quietHoursStart: varchar("quiet_hours_start", { length: 5 }),
  quietHoursEnd: varchar("quiet_hours_end", { length: 5 }),
  channelOverrides: jsonb("channel_overrides"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailQueue = pgTable(
  "email_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    toAddresses: jsonb("to_addresses").$type<string[]>().notNull(),
    ccAddresses: jsonb("cc_addresses").$type<string[]>(),
    bccAddresses: jsonb("bcc_addresses").$type<string[]>(),
    subject: varchar("subject", { length: 500 }).notNull(),
    htmlBody: text("html_body").notNull(),
    textBody: text("text_body"),
    attachments: jsonb("attachments"),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").notNull().default(0),
    maxRetries: integer("max_retries").notNull().default(3),
    staggerDelayMs: integer("stagger_delay_ms").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("email_queue_status_idx").on(table.status),
    index("email_queue_scheduled_at_idx").on(table.scheduledAt),
    index("email_queue_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const communicationLog = pgTable(
  "communication_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: varchar("channel", { length: 10 }).notNull(),
    communicationType: varchar("communication_type", { length: 50 }).notNull(),
    recipient: text("recipient").notNull(),
    subject: varchar("subject", { length: 500 }),
    bodyPreview: text("body_preview"),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),
    status: varchar("status", { length: 20 }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("communication_log_entity_idx").on(table.entityType, table.entityId),
    index("communication_log_channel_idx").on(table.channel),
    index("communication_log_created_at_idx").on(table.createdAt),
    index("communication_log_recipient_idx").on(table.recipient),
  ],
);

// ══════════════════════════════════════════════════════════════════
// ── Xero Integration Tables (doc 11) ──
// ══════════════════════════════════════════════════════════════════

export const xeroConnection = pgTable("xero_connection", {
  id: uuid("id").primaryKey().defaultRandom(),
  xeroTenantId: varchar("xero_tenant_id", { length: 100 }).notNull(),
  xeroOrgName: varchar("xero_org_name", { length: 255 }),
  status: varchar("status", { length: 20 }).notNull().default("disconnected"),
  accessTokenEncrypted: text("access_token_encrypted"),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  scopes: text("scopes"),
  connectedBy: text("connected_by"),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
  lastError: text("last_error"),
  autoCreateContacts: boolean("auto_create_contacts").notNull().default(true),
  autoSyncPayments: boolean("auto_sync_payments").notNull().default(true),
  pollIntervalMinutes: integer("poll_interval_minutes").notNull().default(15),
  batchSize: integer("batch_size").notNull().default(50),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const xeroAccounts = pgTable(
  "xero_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    xeroAccountId: varchar("xero_account_id", { length: 100 }).notNull(),
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    accountType: varchar("account_type", { length: 30 }).notNull(),
    taxType: varchar("tax_type", { length: 30 }),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("xero_accounts_code_idx").on(table.code),
    index("xero_accounts_type_idx").on(table.accountType),
  ],
);

export const xeroTaxRates = pgTable("xero_tax_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  taxType: varchar("tax_type", { length: 30 }).notNull(),
  effectiveRate: numeric("effective_rate", { precision: 8, scale: 4 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const xeroTrackingCategories = pgTable("xero_tracking_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  xeroCategoryId: varchar("xero_category_id", { length: 100 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
  options: jsonb("options"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const xeroAccountMappings = pgTable(
  "xero_account_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pricingCategory: varchar("pricing_category", { length: 50 }).notNull(),
    revenueAccountCode: varchar("revenue_account_code", { length: 20 }),
    expenseAccountCode: varchar("expense_account_code", { length: 20 }),
    taxType: varchar("tax_type", { length: 30 }),
    trackingCategoryId: varchar("tracking_category_id", { length: 100 }),
    trackingOptionId: varchar("tracking_option_id", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("xero_account_mappings_category_idx").on(table.pricingCategory),
  ],
);

export const xeroContactLinks = pgTable(
  "xero_contact_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id).unique(),
    xeroContactId: varchar("xero_contact_id", { length: 100 }).notNull(),
    isCustomer: boolean("is_customer").notNull().default(false),
    isSupplier: boolean("is_supplier").notNull().default(false),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("xero_contact_links_xero_id_idx").on(table.xeroContactId),
  ],
);

export const xeroSyncLog = pgTable(
  "xero_sync_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    syncType: varchar("sync_type", { length: 30 }).notNull(),
    direction: varchar("direction", { length: 10 }).notNull(),
    resourceId: uuid("resource_id"),
    xeroResourceId: varchar("xero_resource_id", { length: 100 }),
    status: varchar("status", { length: 20 }).notNull(),
    errorMessage: text("error_message"),
    requestData: jsonb("request_data"),
    responseData: jsonb("response_data"),
    triggeredBy: text("triggered_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("xero_sync_log_type_idx").on(table.syncType),
    index("xero_sync_log_status_idx").on(table.status),
    index("xero_sync_log_resource_idx").on(table.resourceId),
    index("xero_sync_log_created_at_idx").on(table.createdAt),
  ],
);

// ══════════════════════════════════════════════════════════════════
// ── Batch Billing Tables (doc 10 deepening) ──
// ══════════════════════════════════════════════════════════════════

export const billingRuns = pgTable(
  "billing_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    periodStart: varchar("period_start", { length: 10 }).notNull(),
    periodEnd: varchar("period_end", { length: 10 }).notNull(),
    customerCount: integer("customer_count").notNull().default(0),
    invoiceCount: integer("invoice_count").notNull().default(0),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    skippedCount: integer("skipped_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    previewData: jsonb("preview_data"),
    reportData: jsonb("report_data"),
    startedBy: text("started_by").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("billing_runs_status_idx").on(table.status),
    index("billing_runs_period_idx").on(table.periodStart, table.periodEnd),
  ],
);

export const billingRunItems = pgTable(
  "billing_run_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billingRunId: uuid("billing_run_id").notNull().references(() => billingRuns.id),
    customerId: uuid("customer_id").notNull().references(() => companies.id),
    invoiceId: uuid("invoice_id").references(() => invoices.id),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    jobCount: integer("job_count").notNull().default(0),
    estimatedTotal: numeric("estimated_total", { precision: 14, scale: 2 }).notNull().default("0"),
    actualTotal: numeric("actual_total", { precision: 14, scale: 2 }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("billing_run_items_run_id_idx").on(table.billingRunId),
    index("billing_run_items_customer_id_idx").on(table.customerId),
  ],
);

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
