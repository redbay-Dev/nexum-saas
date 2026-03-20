import type { z } from "zod";
import type {
  baseEntitySchema,
  paginationQuerySchema,
  apiErrorSchema,
  createTenantSchema,
  createUserSchema,
  loginSchema,
  organisationSchema,
  createCompanySchema,
  updateCompanySchema,
  createContactSchema,
  updateContactSchema,
  createAddressSchema,
  updateAddressSchema,
  createEntryPointSchema,
  createRegionSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  createLicenceSchema,
  updateLicenceSchema,
  createMedicalSchema,
  updateMedicalSchema,
  createQualificationTypeSchema,
  updateQualificationTypeSchema,
  createQualificationSchema,
  updateQualificationSchema,
  emergencyContactSchema,
  createAssetCategorySchema,
  updateAssetCategorySchema,
  createAssetSubcategorySchema,
  updateAssetSubcategorySchema,
  createAssetSchema,
  updateAssetSchema,
  equipmentFittedSchema,
  createDefaultPairingSchema,
} from "../schemas/index.js";

// ── Base Types ──

export type BaseEntity = z.infer<typeof baseEntitySchema>;

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export type ApiError = z.infer<typeof apiErrorSchema>;

// ── Tenant Types ──

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

// ── User Types ──

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// ── Organisation Types ──

export type OrganisationInput = z.infer<typeof organisationSchema>;

// ── Company Types ──

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

// ── Contact Types ──

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

// ── Address Types ──

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;

// ── Entry Point Types ──

export type CreateEntryPointInput = z.infer<typeof createEntryPointSchema>;

// ── Region Types ──

export type CreateRegionInput = z.infer<typeof createRegionSchema>;

// ── Employee Types ──

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmergencyContact = z.infer<typeof emergencyContactSchema>;
export type CreateLicenceInput = z.infer<typeof createLicenceSchema>;
export type UpdateLicenceInput = z.infer<typeof updateLicenceSchema>;
export type CreateMedicalInput = z.infer<typeof createMedicalSchema>;
export type UpdateMedicalInput = z.infer<typeof updateMedicalSchema>;
export type CreateQualificationTypeInput = z.infer<typeof createQualificationTypeSchema>;
export type UpdateQualificationTypeInput = z.infer<typeof updateQualificationTypeSchema>;
export type CreateQualificationInput = z.infer<typeof createQualificationSchema>;
export type UpdateQualificationInput = z.infer<typeof updateQualificationSchema>;

// ── Asset Types ──

export type CreateAssetCategoryInput = z.infer<typeof createAssetCategorySchema>;
export type UpdateAssetCategoryInput = z.infer<typeof updateAssetCategorySchema>;
export type CreateAssetSubcategoryInput = z.infer<typeof createAssetSubcategorySchema>;
export type UpdateAssetSubcategoryInput = z.infer<typeof updateAssetSubcategorySchema>;
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type EquipmentFitted = z.infer<typeof equipmentFittedSchema>;
export type CreateDefaultPairingInput = z.infer<typeof createDefaultPairingSchema>;

// ── Tenant Context (used by middleware) ──

export interface TenantContext {
  userId: string;
  userEmail: string;
  tenantId: string;
  schemaName: string;
  role: string;
  isOwner: boolean;
}
