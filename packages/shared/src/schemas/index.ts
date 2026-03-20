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
  INVOICE_STATUSES,
  RCTI_STATUSES,
  DAYSHEET_STATUSES,
  DOCKET_STATUSES,
  ASSET_CATEGORIES,
  PRICING_BEHAVIOURS,
  ADDRESS_TYPES,
  CONTACT_STATUSES,
  ENTRY_POINT_STATUSES,
  MODULES,
  AUDIT_ACTIONS,
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

// ── Pricing Schemas ──

export const pricingBehaviourSchema = z.enum(PRICING_BEHAVIOURS);

// ── Audit Log Schema ──

export const auditActionSchema = z.enum(AUDIT_ACTIONS);

// ── ID Parameter Schema (reusable) ──

export const idParamSchema = z.object({
  id: z.uuid(),
});
