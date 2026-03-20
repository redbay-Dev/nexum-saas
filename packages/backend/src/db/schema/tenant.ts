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
