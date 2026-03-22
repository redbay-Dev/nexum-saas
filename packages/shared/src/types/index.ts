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
  materialComplianceSchema,
  createMaterialCategorySchema,
  updateMaterialCategorySchema,
  createMaterialSubcategorySchema,
  updateMaterialSubcategorySchema,
  createTenantMaterialSchema,
  updateTenantMaterialSchema,
  createSupplierMaterialSchema,
  updateSupplierMaterialSchema,
  createCustomerMaterialSchema,
  updateCustomerMaterialSchema,
  createDisposalMaterialSchema,
  updateDisposalMaterialSchema,
  createDisposalSiteSettingsSchema,
  updateDisposalSiteSettingsSchema,
  createJobTypeSchema,
  updateJobTypeSchema,
  createProjectSchema,
  updateProjectSchema,
  createJobSchema,
  updateJobSchema,
  jobStatusTransitionSchema,
  createJobLocationSchema,
  updateJobLocationSchema,
  createJobMaterialSchema,
  updateJobMaterialSchema,
  createJobAssetRequirementSchema,
  updateJobAssetRequirementSchema,
  createJobPricingLineSchema,
  updateJobPricingLineSchema,
  jobTypeVisibleSectionsSchema,
  jobTypeRequiredFieldsSchema,
  jobTypeDefaultsSchema,
  createJobAssignmentSchema,
  updateJobAssignmentSchema,
  // Documents
  uploadDocumentSchema,
  updateDocumentSchema,
  createPublicLinkSchema,
  documentMetadataSchema,
  // Communications
  queueEmailSchema,
  updateNotificationPreferencesSchema,
  // Xero
  xeroAccountMappingSchema,
  xeroSyncSettingsSchema,
  xeroSyncInvoicesSchema,
  xeroSyncBillsSchema,
  xeroLinkContactSchema,
  xeroForceMatchSchema,
  // Batch billing
  createBillingRunSchema,
  batchVerifyInvoicesSchema,
  batchSendInvoicesSchema,
  sendRemittanceSchema,
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

// ── Material Types ──

export type MaterialCompliance = z.infer<typeof materialComplianceSchema>;
export type CreateMaterialCategoryInput = z.infer<typeof createMaterialCategorySchema>;
export type UpdateMaterialCategoryInput = z.infer<typeof updateMaterialCategorySchema>;
export type CreateMaterialSubcategoryInput = z.infer<typeof createMaterialSubcategorySchema>;
export type UpdateMaterialSubcategoryInput = z.infer<typeof updateMaterialSubcategorySchema>;
export type CreateTenantMaterialInput = z.infer<typeof createTenantMaterialSchema>;
export type UpdateTenantMaterialInput = z.infer<typeof updateTenantMaterialSchema>;
export type CreateSupplierMaterialInput = z.infer<typeof createSupplierMaterialSchema>;
export type UpdateSupplierMaterialInput = z.infer<typeof updateSupplierMaterialSchema>;
export type CreateCustomerMaterialInput = z.infer<typeof createCustomerMaterialSchema>;
export type UpdateCustomerMaterialInput = z.infer<typeof updateCustomerMaterialSchema>;
export type CreateDisposalMaterialInput = z.infer<typeof createDisposalMaterialSchema>;
export type UpdateDisposalMaterialInput = z.infer<typeof updateDisposalMaterialSchema>;
export type CreateDisposalSiteSettingsInput = z.infer<typeof createDisposalSiteSettingsSchema>;
export type UpdateDisposalSiteSettingsInput = z.infer<typeof updateDisposalSiteSettingsSchema>;

// ── Job Type Types ──

export type CreateJobTypeInput = z.infer<typeof createJobTypeSchema>;
export type UpdateJobTypeInput = z.infer<typeof updateJobTypeSchema>;
export type JobTypeVisibleSections = z.infer<typeof jobTypeVisibleSectionsSchema>;
export type JobTypeRequiredFields = z.infer<typeof jobTypeRequiredFieldsSchema>;
export type JobTypeDefaults = z.infer<typeof jobTypeDefaultsSchema>;

// ── Project Types ──

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// ── Job Types ──

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type JobStatusTransition = z.infer<typeof jobStatusTransitionSchema>;
export type CreateJobLocationInput = z.infer<typeof createJobLocationSchema>;
export type UpdateJobLocationInput = z.infer<typeof updateJobLocationSchema>;
export type CreateJobMaterialInput = z.infer<typeof createJobMaterialSchema>;
export type UpdateJobMaterialInput = z.infer<typeof updateJobMaterialSchema>;
export type CreateJobAssetRequirementInput = z.infer<typeof createJobAssetRequirementSchema>;
export type UpdateJobAssetRequirementInput = z.infer<typeof updateJobAssetRequirementSchema>;
export type CreateJobPricingLineInput = z.infer<typeof createJobPricingLineSchema>;
export type UpdateJobPricingLineInput = z.infer<typeof updateJobPricingLineSchema>;

// ── Job Assignments ──

export type CreateJobAssignmentInput = z.infer<typeof createJobAssignmentSchema>;
export type UpdateJobAssignmentInput = z.infer<typeof updateJobAssignmentSchema>;

// ── Document Types ──

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type CreatePublicLinkInput = z.infer<typeof createPublicLinkSchema>;
export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;

// ── Communication Types ──

export type QueueEmailInput = z.infer<typeof queueEmailSchema>;
export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;

// ── Xero Types ──

export type XeroAccountMappingInput = z.infer<typeof xeroAccountMappingSchema>;
export type XeroSyncSettingsInput = z.infer<typeof xeroSyncSettingsSchema>;
export type XeroSyncInvoicesInput = z.infer<typeof xeroSyncInvoicesSchema>;
export type XeroSyncBillsInput = z.infer<typeof xeroSyncBillsSchema>;
export type XeroLinkContactInput = z.infer<typeof xeroLinkContactSchema>;
export type XeroForceMatchInput = z.infer<typeof xeroForceMatchSchema>;

// ── Batch Billing Types ──

export type CreateBillingRunInput = z.infer<typeof createBillingRunSchema>;
export type BatchVerifyInvoicesInput = z.infer<typeof batchVerifyInvoicesSchema>;
export type BatchSendInvoicesInput = z.infer<typeof batchSendInvoicesSchema>;
export type SendRemittanceInput = z.infer<typeof sendRemittanceSchema>;

// ── Tenant Context (used by middleware) ──

export interface TenantContext {
  userId: string;
  userEmail: string;
  tenantId: string;
  schemaName: string;
  role: string;
  isOwner: boolean;
}
