import { z } from "zod";
import {
  AUSTRALIAN_STATES,
  TENANT_STATUSES,
  SUBSCRIPTION_PLANS,
  USER_ROLES,
  PORTAL_ROLES,
  COMPANY_ROLES,
  COMPANY_STATUSES,
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  LICENCE_CLASSES,
  JOB_STATUSES,
  JOB_PRIORITIES,
  JOB_LOCATION_TYPES,
  JOB_PRICING_LINE_TYPES,
  JOB_PRICING_RATE_TYPES,
  JOB_PRICING_CATEGORIES,
  JOB_PRICING_SOURCES,
  DEALLOCATION_REASONS,
  USER_STATUSES,
  PROJECT_STATUSES,
  INVOICE_STATUSES,
  RCTI_STATUSES,
  DAYSHEET_STATUSES,
  DOCKET_STATUSES,
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  ASSET_OWNERSHIP_TYPES,
  INDUSTRY_TYPES,
  PRICING_BEHAVIOURS,
  ADDRESS_TYPES,
  CONTACT_STATUSES,
  ENTRY_POINT_STATUSES,
  MODULES,
  AUDIT_ACTIONS,
  MATERIAL_CATEGORY_TYPES,
  MATERIAL_SOURCE_TYPES,
  MATERIAL_MODES,
  MATERIAL_FLOW_TYPES,
  MATERIAL_PRICING_BEHAVIOURS,
  UNITS_OF_MEASURE,
  MATERIAL_STATUSES,
  DG_CLASSES,
  PACKING_GROUPS,
  JOB_ASSIGNMENT_TYPES,
  JOB_ASSIGNMENT_STATUSES,
  CREDIT_TYPES,
  MARKUP_RULE_TYPES,
  SURCHARGE_TYPES,
  MARGIN_THRESHOLD_LEVELS,
  PRICE_CHANGE_SOURCES,
  QUOTE_PRICING_MODES,
} from "../constants/index.js";

// ── Base Entity Fields ──

export const baseEntitySchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const softDeleteSchema = z.object({
  deletedAt: z.iso.datetime().nullable(),
});

// ── Pagination ──

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
    total: z.number().optional(),
  });

// ── API Response Envelopes ──

export const apiSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const apiErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

// ── Australian-Specific Schemas ──

export const abnSchema = z
  .string()
  .regex(/^\d{11}$/, "ABN must be exactly 11 digits");

export const phoneSchema = z.e164();

export const australianStateSchema = z.enum(AUSTRALIAN_STATES);

// ── Tenant Schemas ──

export const tenantStatusSchema = z.enum(TENANT_STATUSES);
export const subscriptionPlanSchema = z.enum(SUBSCRIPTION_PLANS);
export const moduleSchema = z.enum(MODULES);

export const createTenantSchema = z.object({
  name: z.string().min(1).max(255),
  abn: abnSchema.optional(),
  plan: subscriptionPlanSchema,
  enabledModules: z.array(moduleSchema).default([]),
});

// ── User & Role Schemas ──

export const userRoleSchema = z.enum(USER_ROLES);
export const portalRoleSchema = z.enum(PORTAL_ROLES);

export const createUserSchema = z.object({
  email: z.email(),
  name: z.string().min(1).max(255),
  role: userRoleSchema,
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});

// ── Organisation Schema (tenant's business identity) ──

export const organisationSchema = z.object({
  companyName: z.string().min(1).max(255),
  tradingName: z.string().max(255).optional(),
  abn: abnSchema,
  phone: phoneSchema.optional(),
  email: z.email().optional(),
  website: z.url().optional(),
  logoUrl: z.string().optional(),
  registeredAddress: z.string().optional(),
  bankBsb: z.string().regex(/^\d{6}$/, "BSB must be 6 digits").optional(),
  bankAccountNumber: z.string().max(20).optional(),
  bankAccountName: z.string().max(255).optional(),
  defaultPaymentTerms: z.number().int().min(0).max(365).default(30),
  timezone: z.string().default("Australia/Brisbane"),
});

// ── Company Schemas ──

export const companyRoleSchema = z.enum(COMPANY_ROLES);
export const companyStatusSchema = z.enum(COMPANY_STATUSES);

export const createCompanySchema = z.object({
  name: z.string().min(1).max(255),
  tradingName: z.string().max(255).optional(),
  abn: abnSchema.optional(),
  phone: phoneSchema.optional(),
  email: z.email().optional(),
  website: z.url().optional(),
  roles: z.array(companyRoleSchema).min(1),
  status: companyStatusSchema.default("active"),
  notes: z.string().optional(),
});

export const updateCompanySchema = createCompanySchema.partial();

// ── Contact Schemas ──

export const contactStatusSchema = z.enum(CONTACT_STATUSES);

export const createContactSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  title: z.string().max(100).optional(),
  phone: phoneSchema.optional(),
  email: z.email().optional(),
  companyId: z.uuid().optional(),
  addressId: z.uuid().optional(),
  preferredContactMethod: z
    .enum(["phone", "email", "sms"])
    .default("email"),
  smsOptIn: z.boolean().default(false),
  status: contactStatusSchema.default("active"),
});

export const updateContactSchema = createContactSchema.partial();

// ── Address Schemas ──

export const addressTypeSchema = z.enum(ADDRESS_TYPES);

export const createAddressSchema = z.object({
  streetAddress: z.string().min(1).max(500),
  suburb: z.string().min(1).max(100),
  state: australianStateSchema,
  postcode: z.string().regex(/^\d{4}$/, "Postcode must be 4 digits"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  regionId: z.uuid().optional(),
  types: z.array(addressTypeSchema).min(1),
  operatingHours: z.string().optional(),
  accessConditions: z.string().optional(),
  siteNotes: z.string().optional(),
});

export const updateAddressSchema = createAddressSchema.partial();

// ── Entry Point Schemas ──

export const entryPointStatusSchema = z.enum(ENTRY_POINT_STATUSES);

export const createEntryPointSchema = z.object({
  addressId: z.uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  vehicleRestrictions: z.string().optional(),
  weightLimit: z.number().positive().optional(),
  operatingHours: z.string().optional(),
  driverInstructions: z.string().optional(),
  status: entryPointStatusSchema.default("active"),
});

export const updateEntryPointSchema = createEntryPointSchema.partial();

// ── Region Schemas ──

export const createRegionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

export const updateRegionSchema = createRegionSchema.partial();

// ── Employee Schemas ──

export const employeeStatusSchema = z.enum(EMPLOYEE_STATUSES);
export const employmentTypeSchema = z.enum(EMPLOYMENT_TYPES);
export const licenceClassSchema = z.enum(LICENCE_CLASSES);

export const emergencyContactSchema = z.object({
  name: z.string().min(1).max(255),
  relationship: z.string().min(1).max(100),
  phone: phoneSchema,
});

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.string().optional(),
  phone: phoneSchema.optional(),
  email: z.email().optional(),
  homeAddress: z.string().max(500).optional(),
  position: z.string().min(1).max(100),
  employmentType: employmentTypeSchema,
  startDate: z.string(),
  department: z.string().max(100).optional(),
  isDriver: z.boolean().default(false),
  contractorCompanyId: z.uuid().optional(),
  emergencyContacts: z.array(emergencyContactSchema).default([]),
  status: employeeStatusSchema.default("active"),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const createLicenceSchema = z.object({
  employeeId: z.uuid(),
  licenceClass: licenceClassSchema,
  licenceNumber: z.string().min(1).max(50),
  stateOfIssue: z.enum(AUSTRALIAN_STATES),
  expiryDate: z.string(),
  conditions: z.string().optional(),
});

export const updateLicenceSchema = createLicenceSchema.omit({ employeeId: true }).partial();

export const createMedicalSchema = z.object({
  employeeId: z.uuid(),
  certificateNumber: z.string().max(100).optional(),
  issuedDate: z.string(),
  expiryDate: z.string(),
  conditions: z.string().optional(),
  notes: z.string().optional(),
});

export const updateMedicalSchema = createMedicalSchema.omit({ employeeId: true }).partial();

export const createQualificationTypeSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  hasExpiry: z.boolean().default(true),
  requiresEvidence: z.boolean().default(true),
});

export const updateQualificationTypeSchema = createQualificationTypeSchema.partial();

export const createQualificationSchema = z.object({
  employeeId: z.uuid(),
  qualificationTypeId: z.uuid(),
  referenceNumber: z.string().max(100).optional(),
  stateOfIssue: z.enum(AUSTRALIAN_STATES).optional(),
  issuedDate: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

export const updateQualificationSchema = createQualificationSchema.omit({ employeeId: true, qualificationTypeId: true }).partial();

// ── Job Schemas ──

export const jobStatusSchema = z.enum(JOB_STATUSES);
export const jobPrioritySchema = z.enum(JOB_PRIORITIES);
export const jobLocationTypeSchema = z.enum(JOB_LOCATION_TYPES);
export const jobPricingLineTypeSchema = z.enum(JOB_PRICING_LINE_TYPES);
export const jobPricingRateTypeSchema = z.enum(JOB_PRICING_RATE_TYPES);
export const jobPricingCategorySchema = z.enum(JOB_PRICING_CATEGORIES);
export const projectStatusSchema = z.enum(PROJECT_STATUSES);

/** JSONB sub-schema: which sections are visible for a job type. */
export const jobTypeVisibleSectionsSchema = z.object({
  locations: z.boolean().default(true),
  materials: z.boolean().default(true),
  assetRequirements: z.boolean().default(true),
  pricing: z.boolean().default(true),
  scheduling: z.boolean().default(true),
});

/** JSONB sub-schema: which fields are required for a job type. */
export const jobTypeRequiredFieldsSchema = z.object({
  poNumber: z.boolean().default(false),
  materials: z.boolean().default(false),
  locations: z.boolean().default(false),
});

/** JSONB sub-schema: default values for a job type. */
export const jobTypeDefaultsSchema = z.object({
  priority: jobPrioritySchema.optional(),
  durationHours: z.number().positive().optional(),
  assetCategoryId: z.uuid().optional(),
});

/** Create a job type (tenant-configurable). */
export const createJobTypeSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  description: z.string().max(500).optional(),
  isSystem: z.boolean().default(false),
  visibleSections: jobTypeVisibleSectionsSchema.optional(),
  requiredFields: jobTypeRequiredFieldsSchema.optional(),
  availablePricingMethods: z.array(jobPricingRateTypeSchema).optional(),
  defaults: jobTypeDefaultsSchema.optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateJobTypeSchema = createJobTypeSchema
  .omit({ isSystem: true })
  .partial();

/** Create a project (optional job grouping). */
export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  customerId: z.uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  salesRepId: z.uuid().optional(),
  projectLeadId: z.uuid().optional(),
  status: projectStatusSchema.default("active"),
  notes: z.string().optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

/** Create a job. */
export const createJobSchema = z.object({
  name: z.string().min(1).max(255),
  jobTypeId: z.uuid(),
  customerId: z.uuid().optional(),
  projectId: z.uuid().optional(),
  poNumber: z.string().max(100).optional(),
  priority: jobPrioritySchema.default("medium"),
  salesRepId: z.uuid().optional(),
  jobLeadId: z.uuid().optional(),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
  isMultiDay: z.boolean().default(false),
  minimumChargeHours: z.number().min(0).optional(),
  overtimeRate: z.number().min(0).optional(),
  overtimeThresholdHours: z.number().min(0).optional(),
  externalNotes: z.string().optional(),
  internalNotes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateJobSchema = createJobSchema.partial();

/** Transition a job's status. */
export const jobStatusTransitionSchema = z.object({
  status: jobStatusSchema,
  reason: z.string().optional(),
});

/** Create a job location. */
export const createJobLocationSchema = z.object({
  locationType: jobLocationTypeSchema,
  addressId: z.uuid(),
  entryPointId: z.uuid().optional(),
  sequence: z.number().int().min(0).default(0),
  contactName: z.string().max(255).optional(),
  contactPhone: z.string().max(20).optional(),
  instructions: z.string().optional(),
  tipFee: z.number().min(0).optional(),
  arrivalTime: z.string().optional(),
  departureTime: z.string().optional(),
});

export const updateJobLocationSchema = createJobLocationSchema.partial();

/** Create a job material (snapshot). */
export const createJobMaterialSchema = z.object({
  materialSourceType: z.enum(MATERIAL_SOURCE_TYPES),
  materialSourceId: z.uuid(),
  quantity: z.number().min(0).optional(),
  unitOfMeasure: z.enum(UNITS_OF_MEASURE).optional(),
  flowType: z.enum(MATERIAL_FLOW_TYPES).optional(),
  notes: z.string().optional(),
});

export const updateJobMaterialSchema = z.object({
  quantity: z.number().min(0).optional(),
  unitOfMeasure: z.enum(UNITS_OF_MEASURE).optional(),
  flowType: z.enum(MATERIAL_FLOW_TYPES).optional(),
  notes: z.string().optional(),
});

/** Create a job asset requirement. */
export const createJobAssetRequirementSchema = z.object({
  assetCategoryId: z.uuid(),
  assetSubcategoryId: z.uuid().optional(),
  quantity: z.number().int().min(1).default(1),
  payloadLimit: z.number().positive().optional(),
  specialRequirements: z.string().optional(),
});

export const updateJobAssetRequirementSchema = createJobAssetRequirementSchema.partial();

/** Job pricing source schema. */
export const jobPricingSourceSchema = z.enum(JOB_PRICING_SOURCES);

/** Credit type schema. */
export const creditTypeSchema = z.enum(CREDIT_TYPES);

/** Create a job pricing line. Supports credits (negative amounts) and tracing fields. */
export const createJobPricingLineSchema = z.object({
  lineType: jobPricingLineTypeSchema,
  partyId: z.uuid().optional(),
  partyName: z.string().max(255).optional(),
  category: jobPricingCategorySchema,
  description: z.string().max(500).optional(),
  rateType: jobPricingRateTypeSchema,
  quantity: z.number().default(0),
  unitRate: z.number().default(0),
  total: z.number().default(0),
  isLocked: z.boolean().default(false),
  isVariation: z.boolean().default(false),
  variationReason: z.string().max(500).optional(),
  source: jobPricingSourceSchema.default("manual"),
  sourceReferenceId: z.uuid().optional(),
  sortOrder: z.number().int().min(0).default(0),
  // Credit support
  creditType: creditTypeSchema.optional(),
  originalLineId: z.uuid().optional(),
  // Snapshot & immutability
  snapshotAt: z.string().optional(),
  // Rate card tracing
  usedCustomerPricing: z.boolean().default(false),
  rateCardEntryId: z.uuid().optional(),
  // Automation tracing
  surchargeId: z.uuid().optional(),
  markupRuleId: z.uuid().optional(),
  // Margin override
  marginOverrideReason: z.string().max(500).optional(),
});

export const updateJobPricingLineSchema = createJobPricingLineSchema.partial();

// ── Job Assignment Schemas ──

const jobAssignmentTypeSchema = z.enum(JOB_ASSIGNMENT_TYPES);
const jobAssignmentStatusSchema = z.enum(JOB_ASSIGNMENT_STATUSES);

/** Create a job assignment (assign asset, driver, or contractor to a job). */
export const createJobAssignmentSchema = z.object({
  assignmentType: jobAssignmentTypeSchema,
  assetId: z.uuid().optional(),
  employeeId: z.uuid().optional(),
  contractorCompanyId: z.uuid().optional(),
  requirementId: z.uuid().optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export const updateJobAssignmentSchema = z.object({
  status: jobAssignmentStatusSchema.optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  actualStart: z.string().optional(),
  actualEnd: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

// ── Invoice Schemas ──

export const invoiceStatusSchema = z.enum(INVOICE_STATUSES);

// ── RCTI Schemas ──

export const rctiStatusSchema = z.enum(RCTI_STATUSES);

// ── Daysheet Schemas ──

export const daysheetStatusSchema = z.enum(DAYSHEET_STATUSES);

// ── Docket Schemas ──

export const docketStatusSchema = z.enum(DOCKET_STATUSES);

// ── Asset Schemas ──

export const assetCategorySchema = z.enum(ASSET_CATEGORIES);
export const assetStatusSchema = z.enum(ASSET_STATUSES);
export const assetOwnershipTypeSchema = z.enum(ASSET_OWNERSHIP_TYPES);
export const industryTypeSchema = z.enum(INDUSTRY_TYPES);

/** Tenant-configurable asset category with per-category feature toggles. */
export const createAssetCategorySchema = z.object({
  name: z.string().min(1).max(100),
  type: assetCategorySchema,
  industryType: industryTypeSchema.default("transport"),
  enableSpecifications: z.boolean().default(true),
  enableWeightSpecs: z.boolean().default(false),
  enableMassScheme: z.boolean().default(false),
  enableEngineHours: z.boolean().default(false),
  enableCapacityFields: z.boolean().default(false),
  enableRegistration: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateAssetCategorySchema = createAssetCategorySchema.partial();

/** Subcategory within a category — e.g. "Prime Mover" under "Truck". */
export const createAssetSubcategorySchema = z.object({
  categoryId: z.uuid(),
  name: z.string().min(1).max(100),
  vehicleConfiguration: z.string().max(100).optional(),
  defaultVolume: z.number().positive().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateAssetSubcategorySchema = createAssetSubcategorySchema
  .omit({ categoryId: true })
  .partial();

/** Equipment fitted flags — stored as JSONB on the asset record. */
export const equipmentFittedSchema = z.object({
  scales: z.boolean().default(false),
  mudLocks: z.boolean().default(false),
  fireExtinguisher: z.boolean().default(false),
  firstAid: z.boolean().default(false),
  uhfRadio: z.boolean().default(false),
  gpsTracking: z.boolean().default(false),
  isolationSwitch: z.boolean().default(false),
});

/** Create a new asset record. */
export const createAssetSchema = z.object({
  // Core identification
  assetNumber: z.string().max(50).optional(),
  categoryId: z.uuid(),
  subcategoryId: z.uuid().optional(),
  ownership: assetOwnershipTypeSchema.default("tenant"),
  contractorCompanyId: z.uuid().optional(),
  status: assetStatusSchema.default("available"),

  // Registration
  registrationNumber: z.string().max(20).optional(),
  registrationState: z.enum(AUSTRALIAN_STATES).optional(),
  registrationExpiry: z.string().optional(),

  // Make/model
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  vin: z.string().max(50).optional(),

  // Weight specs (shown/hidden by category toggles)
  tareWeight: z.number().positive().optional(),
  gvm: z.number().positive().optional(),
  gcm: z.number().positive().optional(),
  vehicleConfiguration: z.string().max(100).optional(),
  massScheme: z.string().max(50).optional(),

  // Body configuration
  bodyMaterial: z.string().max(100).optional(),
  sideHeight: z.number().positive().optional(),
  bodyType: z.string().max(100).optional(),

  // Equipment fitted
  equipmentFitted: equipmentFittedSchema.optional(),

  // Capacity
  capacity: z.number().positive().optional(),
  capacityUnit: z.string().max(20).optional(),

  // Tracking
  engineHours: z.number().min(0).optional(),
  engineHoursDate: z.string().optional(),
  odometer: z.number().min(0).optional(),
  odometerDate: z.string().optional(),

  notes: z.string().optional(),
});

export const updateAssetSchema = createAssetSchema.partial();

/** Default pairing between a truck and trailer. */
export const createDefaultPairingSchema = z.object({
  truckId: z.uuid(),
  trailerId: z.uuid(),
  notes: z.string().optional(),
});

// ── Material Schemas ──

export const materialCategoryTypeSchema = z.enum(MATERIAL_CATEGORY_TYPES);
export const materialSourceTypeSchema = z.enum(MATERIAL_SOURCE_TYPES);
export const materialModeSchema = z.enum(MATERIAL_MODES);
export const materialFlowTypeSchema = z.enum(MATERIAL_FLOW_TYPES);
export const materialPricingBehaviourSchema = z.enum(MATERIAL_PRICING_BEHAVIOURS);
export const unitOfMeasureSchema = z.enum(UNITS_OF_MEASURE);
export const materialStatusSchema = z.enum(MATERIAL_STATUSES);
export const dgClassSchema = z.enum(DG_CLASSES);
export const packingGroupSchema = z.enum(PACKING_GROUPS);

/** Compliance flags shared across all material source tables. */
export const materialComplianceSchema = z.object({
  isHazardous: z.boolean().default(false),
  isRegulatedWaste: z.boolean().default(false),
  isDangerousGoods: z.boolean().default(false),
  requiresTracking: z.boolean().default(false),
  requiresAuthority: z.boolean().default(false),
  unNumber: z.string().max(10).optional(),
  dgClass: dgClassSchema.optional(),
  packingGroup: packingGroupSchema.optional(),
  wasteCode: z.string().max(50).optional(),
  epaCategory: z.string().max(100).optional(),
});

/** Create a material category (top-level grouping). */
export const createMaterialCategorySchema = z.object({
  name: z.string().min(1).max(100),
  type: materialCategoryTypeSchema,
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateMaterialCategorySchema = createMaterialCategorySchema.partial();

/** Create a material subcategory (e.g. "Brickies Sand" under "Sand"). */
export const createMaterialSubcategorySchema = z.object({
  categoryId: z.uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  densityFactor: z.number().positive().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateMaterialSubcategorySchema = createMaterialSubcategorySchema
  .omit({ categoryId: true })
  .partial();

/** Create a tenant-owned material (own stockpile). */
export const createTenantMaterialSchema = z.object({
  name: z.string().min(1).max(255),
  subcategoryId: z.uuid().optional(),
  unitOfMeasure: unitOfMeasureSchema,
  addressId: z.uuid().optional(),
  description: z.string().max(500).optional(),
  densityFactor: z.number().positive().optional(),
  status: materialStatusSchema.default("active"),
  compliance: materialComplianceSchema.optional(),
  notes: z.string().optional(),
});

export const updateTenantMaterialSchema = createTenantMaterialSchema.partial();

/** Create a supplier material (buy-side). */
export const createSupplierMaterialSchema = z.object({
  supplierId: z.uuid(),
  supplierName: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  subcategoryId: z.uuid().optional(),
  unitOfMeasure: unitOfMeasureSchema,
  addressId: z.uuid().optional(),
  supplierProductCode: z.string().max(50).optional(),
  purchasePrice: z.number().min(0).optional(),
  minimumOrderQty: z.number().positive().optional(),
  description: z.string().max(500).optional(),
  densityFactor: z.number().positive().optional(),
  status: materialStatusSchema.default("active"),
  compliance: materialComplianceSchema.optional(),
  notes: z.string().optional(),
});

export const updateSupplierMaterialSchema = createSupplierMaterialSchema.partial();

/** Create a customer material (sell-side). */
export const createCustomerMaterialSchema = z.object({
  customerId: z.uuid(),
  customerName: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  subcategoryId: z.uuid().optional(),
  unitOfMeasure: unitOfMeasureSchema,
  addressId: z.uuid().optional(),
  salePrice: z.number().min(0).optional(),
  description: z.string().max(500).optional(),
  densityFactor: z.number().positive().optional(),
  status: materialStatusSchema.default("active"),
  compliance: materialComplianceSchema.optional(),
  notes: z.string().optional(),
});

export const updateCustomerMaterialSchema = createCustomerMaterialSchema.partial();

/** Create a disposal site material (accept/supply). */
export const createDisposalMaterialSchema = z.object({
  addressId: z.uuid(),
  name: z.string().min(1).max(255),
  subcategoryId: z.uuid().optional(),
  unitOfMeasure: unitOfMeasureSchema,
  materialMode: materialModeSchema,
  tipFee: z.number().min(0).optional(),
  environmentalLevy: z.number().min(0).optional(),
  minimumCharge: z.number().min(0).optional(),
  salePrice: z.number().min(0).optional(),
  description: z.string().max(500).optional(),
  densityFactor: z.number().positive().optional(),
  status: materialStatusSchema.default("active"),
  compliance: materialComplianceSchema.optional(),
  notes: z.string().optional(),
});

export const updateDisposalMaterialSchema = createDisposalMaterialSchema.partial();

/** Disposal site settings (site-level configuration). */
export const createDisposalSiteSettingsSchema = z.object({
  addressId: z.uuid(),
  operatingHours: z.string().max(500).optional(),
  acceptedMaterials: z.string().max(1000).optional(),
  rejectedMaterials: z.string().max(1000).optional(),
  epaLicenceNumber: z.string().max(100).optional(),
  epaLicenceExpiry: z.string().optional(),
  wasteCodes: z.string().max(500).optional(),
  accountTerms: z.string().max(500).optional(),
  creditLimit: z.number().min(0).optional(),
  preApprovalRequired: z.boolean().default(false),
  accountsContactName: z.string().max(255).optional(),
  accountsContactPhone: z.string().max(20).optional(),
  accountsContactEmail: z.email().optional(),
  notes: z.string().optional(),
});

export const updateDisposalSiteSettingsSchema = createDisposalSiteSettingsSchema
  .omit({ addressId: true })
  .partial();

// ── Pricing Schemas ──

export const pricingBehaviourSchema = z.enum(PRICING_BEHAVIOURS);

/** Job financial summary (computed from pricing lines). */
export const jobFinancialSummarySchema = z.object({
  totalRevenue: z.number(),
  totalCost: z.number(),
  grossProfit: z.number(),
  marginPercent: z.number().nullable(),
  categoryBreakdown: z.array(
    z.object({
      category: jobPricingCategorySchema,
      revenue: z.number(),
      cost: z.number(),
    }),
  ),
});

// ── Deallocation Schema ──

export const deallocationReasonSchema = z.enum(DEALLOCATION_REASONS);

export const deallocateAssignmentSchema = z.object({
  reason: deallocationReasonSchema,
  notes: z.string().max(1000).optional(),
  completedLoads: z.number().int().min(0).optional(),
});

// ── Bulk Allocation Schema ──

export const bulkAllocationItemSchema = z.object({
  assignmentType: z.enum(JOB_ASSIGNMENT_TYPES),
  assetId: z.uuid().optional(),
  employeeId: z.uuid().optional(),
  contractorCompanyId: z.uuid().optional(),
  requirementId: z.uuid().optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export const bulkAllocationSchema = z.object({
  jobId: z.uuid(),
  allocations: z.array(bulkAllocationItemSchema).min(1).max(300),
});

// ── Organisation Update Schema ──

export const quotePricingModeSchema = z.enum(QUOTE_PRICING_MODES);

export const updateOrganisationSchema = z.object({
  companyName: z.string().min(1).max(255).optional(),
  tradingName: z.string().max(255).optional(),
  abn: abnSchema.optional(),
  phone: phoneSchema.optional(),
  email: z.email().optional(),
  website: z.url().optional(),
  logoUrl: z.string().optional(),
  registeredAddress: z.string().optional(),
  bankBsb: z.string().regex(/^\d{6}$/, "BSB must be 6 digits").optional(),
  bankAccountNumber: z.string().max(20).optional(),
  bankAccountName: z.string().max(255).optional(),
  defaultPaymentTerms: z.number().int().min(0).max(365).optional(),
  timezone: z.string().optional(),
  quotePricingMode: quotePricingModeSchema.optional(),
  staleRateThresholdDays: z.number().int().min(1).max(730).optional(),
});

// ── User Management Schemas ──

export const userAccountStatusSchema = z.enum(USER_STATUSES);

export const updateUserRoleSchema = z.object({
  role: userRoleSchema,
});

export const updateUserStatusSchema = z.object({
  status: userAccountStatusSchema,
});

// ── Audit Log Query Schema ──

export const auditLogQuerySchema = paginationQuerySchema.extend({
  userId: z.string().optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  entityType: z.string().max(50).optional(),
  entityId: z.uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
});

// ── Audit Log Schema ──

export const auditActionSchema = z.enum(AUDIT_ACTIONS);

// ── ID Parameter Schema (reusable) ──

export const idParamSchema = z.object({
  id: z.uuid(),
});

// ══════════════════════════════════════════════════════════════════
// ── Pricing Engine Schemas (doc 09) ──
// ══════════════════════════════════════════════════════════════════

// ── Customer Rate Cards ──

export const createCustomerRateCardSchema = z.object({
  customerId: z.uuid(),
  name: z.string().min(1).max(255),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().max(1000).optional(),
});

export const updateCustomerRateCardSchema = createCustomerRateCardSchema
  .omit({ customerId: true })
  .partial();

export const createRateCardEntrySchema = z.object({
  materialSubcategoryId: z.uuid().optional(),
  category: jobPricingCategorySchema,
  rateType: jobPricingRateTypeSchema,
  unitRate: z.number(),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateRateCardEntrySchema = createRateCardEntrySchema.partial();

export const rateLookupQuerySchema = z.object({
  customerId: z.uuid(),
  materialSubcategoryId: z.uuid().optional(),
  category: jobPricingCategorySchema,
  rateType: jobPricingRateTypeSchema,
  jobDate: z.string().optional(),
});

// ── Markup Rules ──

export const markupRuleTypeSchema = z.enum(MARKUP_RULE_TYPES);

export const createMarkupRuleSchema = z.object({
  name: z.string().min(1).max(255),
  type: markupRuleTypeSchema,
  markupPercentage: z.number().min(0).max(10000).optional(),
  markupFixedAmount: z.number().min(0).optional(),
  materialCategoryId: z.uuid().optional(),
  supplierId: z.uuid().optional(),
  priority: z.number().int().min(0).default(100),
  isActive: z.boolean().default(true),
  notes: z.string().max(1000).optional(),
});

export const updateMarkupRuleSchema = createMarkupRuleSchema.partial();

export const markupRuleTestSchema = z.object({
  materialCategoryId: z.uuid().optional(),
  supplierId: z.uuid().optional(),
  unitRate: z.number(),
  quantity: z.number().default(1),
});

// ── Margin Thresholds ──

export const marginThresholdLevelSchema = z.enum(MARGIN_THRESHOLD_LEVELS);

export const createMarginThresholdSchema = z.object({
  level: marginThresholdLevelSchema,
  referenceId: z.uuid().optional(),
  minimumMarginPercent: z.number().min(0).max(100),
  warningMarginPercent: z.number().min(0).max(100),
  requiresApproval: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const updateMarginThresholdSchema = createMarginThresholdSchema.partial();

// ── Surcharges ──

export const surchargeTypeSchema = z.enum(SURCHARGE_TYPES);

export const createSurchargeSchema = z.object({
  name: z.string().min(1).max(255),
  type: surchargeTypeSchema,
  value: z.number(),
  appliesTo: z.array(jobPricingCategorySchema).min(1),
  autoApply: z.boolean().default(true),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().max(1000).optional(),
});

export const updateSurchargeSchema = createSurchargeSchema.partial();

// ── Pricing Templates ──

export const createPricingTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().default(true),
});

export const updatePricingTemplateSchema = createPricingTemplateSchema.partial();

export const createTemplateLineSchema = z.object({
  lineType: jobPricingLineTypeSchema,
  category: jobPricingCategorySchema,
  description: z.string().max(500).optional(),
  rateType: jobPricingRateTypeSchema,
  unitRate: z.number().optional(),
  quantity: z.number().optional(),
  partyId: z.uuid().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateTemplateLineSchema = createTemplateLineSchema.partial();

export const applyPricingTemplateSchema = z.object({
  jobId: z.uuid(),
});

// ── Price History ──

export const priceChangeSourceSchema = z.enum(PRICE_CHANGE_SOURCES);

export const priceHistoryQuerySchema = paginationQuerySchema.extend({
  entityType: z.string(),
  entityId: z.uuid(),
});

export const bulkPriceUpdateSchema = z.object({
  materialIds: z.array(z.uuid()).min(1).max(500),
  percentage: z.number().min(-100).max(10000),
  effectiveDate: z.string(),
});

export const supplierBulkPriceUpdateSchema = z.object({
  supplierId: z.uuid(),
  percentage: z.number().min(-100).max(10000),
  effectiveDate: z.string(),
});

// ── Pricing Allocations ──

export const createPricingAllocationSchema = z.object({
  customerId: z.uuid(),
  amount: z.number(),
  percentage: z.number().min(0).max(100),
});

export const updatePricingAllocationSchema = createPricingAllocationSchema.partial();
