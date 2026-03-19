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

// ── Tenant Context (used by middleware) ──

export interface TenantContext {
  userId: string;
  userEmail: string;
  tenantId: string;
  schemaName: string;
  role: string;
  isOwner: boolean;
}
