import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import type { PaginatedResponse } from "@nexum/shared";

// ── Shared material types ──

interface MaterialCompliance {
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
}

interface BaseMaterial {
  id: string;
  name: string;
  subcategoryId: string | null;
  unitOfMeasure: string;
  addressId: string | null;
  description: string | null;
  densityFactor: string | null;
  status: string;
  compliance: MaterialCompliance | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined
  subcategoryName: string | null;
  categoryName: string | null;
  addressLabel: string | null;
}

export type TenantMaterial = BaseMaterial;

export interface SupplierMaterial extends BaseMaterial {
  supplierId: string;
  supplierName: string;
  supplierProductCode: string | null;
  purchasePrice: string | null;
  minimumOrderQty: string | null;
  companyName: string | null;
}

export interface CustomerMaterial extends BaseMaterial {
  customerId: string;
  customerName: string;
  salePrice: string | null;
  companyName: string | null;
}

export interface DisposalMaterial extends BaseMaterial {
  materialMode: string;
  tipFee: string | null;
  environmentalLevy: string | null;
  minimumCharge: string | null;
  salePrice: string | null;
}

export interface DisposalSiteSettings {
  id: string;
  addressId: string;
  operatingHours: string | null;
  acceptedMaterials: string | null;
  rejectedMaterials: string | null;
  epaLicenceNumber: string | null;
  epaLicenceExpiry: string | null;
  wasteCodes: string | null;
  accountTerms: string | null;
  creditLimit: string | null;
  preApprovalRequired: boolean;
  accountsContactName: string | null;
  accountsContactPhone: string | null;
  accountsContactEmail: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Query key factory ──

const materialKeys = {
  all: ["materials"] as const,
  tenant: {
    lists: () => [...materialKeys.all, "tenant", "list"] as const,
    list: (params: MaterialListParams) => [...materialKeys.tenant.lists(), params] as const,
    details: () => [...materialKeys.all, "tenant", "detail"] as const,
    detail: (id: string) => [...materialKeys.tenant.details(), id] as const,
  },
  supplier: {
    lists: () => [...materialKeys.all, "supplier", "list"] as const,
    list: (params: MaterialListParams) => [...materialKeys.supplier.lists(), params] as const,
    details: () => [...materialKeys.all, "supplier", "detail"] as const,
    detail: (id: string) => [...materialKeys.supplier.details(), id] as const,
  },
  customer: {
    lists: () => [...materialKeys.all, "customer", "list"] as const,
    list: (params: MaterialListParams) => [...materialKeys.customer.lists(), params] as const,
    details: () => [...materialKeys.all, "customer", "detail"] as const,
    detail: (id: string) => [...materialKeys.customer.details(), id] as const,
  },
  disposal: {
    lists: () => [...materialKeys.all, "disposal", "list"] as const,
    list: (params: MaterialListParams) => [...materialKeys.disposal.lists(), params] as const,
    details: () => [...materialKeys.all, "disposal", "detail"] as const,
    detail: (id: string) => [...materialKeys.disposal.details(), id] as const,
  },
  siteSettings: (addressId: string) => [...materialKeys.all, "site-settings", addressId] as const,
};

export interface MaterialListParams {
  search?: string;
  subcategoryId?: string;
  status?: string;
  addressId?: string;
  supplierId?: string;
  customerId?: string;
  materialMode?: string;
  limit?: number;
  cursor?: string;
}

function buildQueryString(params: MaterialListParams): string {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.subcategoryId) sp.set("subcategoryId", params.subcategoryId);
  if (params.status) sp.set("status", params.status);
  if (params.addressId) sp.set("addressId", params.addressId);
  if (params.supplierId) sp.set("supplierId", params.supplierId);
  if (params.customerId) sp.set("customerId", params.customerId);
  if (params.materialMode) sp.set("materialMode", params.materialMode);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.cursor) sp.set("cursor", params.cursor);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

// ── Tenant materials ──

export function useTenantMaterials(
  params: MaterialListParams = {},
): ReturnType<typeof useQuery<PaginatedResponse<TenantMaterial>>> {
  return useQuery({
    queryKey: materialKeys.tenant.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<TenantMaterial>>(
        `/api/v1/materials/tenant${buildQueryString(params)}`,
      ),
  });
}

export function useTenantMaterial(
  id: string,
): ReturnType<typeof useQuery<TenantMaterial>> {
  return useQuery({
    queryKey: materialKeys.tenant.detail(id),
    queryFn: () => api.get<TenantMaterial>(`/api/v1/materials/tenant/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateTenantMaterial(): ReturnType<
  typeof useMutation<TenantMaterial, Error, Record<string, unknown>>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<TenantMaterial>("/api/v1/materials/tenant", data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: materialKeys.tenant.lists() });
    },
  });
}

export function useUpdateTenantMaterial(
  id: string,
): ReturnType<typeof useMutation<TenantMaterial, Error, Record<string, unknown>>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put<TenantMaterial>(`/api/v1/materials/tenant/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: materialKeys.tenant.lists() });
      void qc.invalidateQueries({ queryKey: materialKeys.tenant.detail(id) });
    },
  });
}

export function useDeleteTenantMaterial(): ReturnType<
  typeof useMutation<{ id: string }, Error, string>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/api/v1/materials/tenant/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: materialKeys.tenant.lists() });
    },
  });
}

// ── Supplier materials ──

export function useSupplierMaterials(
  params: MaterialListParams = {},
): ReturnType<typeof useQuery<PaginatedResponse<SupplierMaterial>>> {
  return useQuery({
    queryKey: materialKeys.supplier.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<SupplierMaterial>>(
        `/api/v1/materials/supplier${buildQueryString(params)}`,
      ),
  });
}

export function useSupplierMaterial(
  id: string,
): ReturnType<typeof useQuery<SupplierMaterial>> {
  return useQuery({
    queryKey: materialKeys.supplier.detail(id),
    queryFn: () => api.get<SupplierMaterial>(`/api/v1/materials/supplier/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateSupplierMaterial(): ReturnType<
  typeof useMutation<SupplierMaterial, Error, Record<string, unknown>>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<SupplierMaterial>("/api/v1/materials/supplier", data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: materialKeys.supplier.lists() });
    },
  });
}

export function useUpdateSupplierMaterial(
  id: string,
): ReturnType<typeof useMutation<SupplierMaterial, Error, Record<string, unknown>>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put<SupplierMaterial>(`/api/v1/materials/supplier/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: materialKeys.supplier.lists() });
      void qc.invalidateQueries({ queryKey: materialKeys.supplier.detail(id) });
    },
  });
}

export function useDeleteSupplierMaterial(): ReturnType<
  typeof useMutation<{ id: string }, Error, string>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/api/v1/materials/supplier/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: materialKeys.supplier.lists() });
    },
  });
}

// ── Customer materials ──

export function useCustomerMaterials(
  params: MaterialListParams = {},
): ReturnType<typeof useQuery<PaginatedResponse<CustomerMaterial>>> {
  return useQuery({
    queryKey: materialKeys.customer.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<CustomerMaterial>>(
        `/api/v1/materials/customer${buildQueryString(params)}`,
      ),
  });
}

export function useCustomerMaterial(
  id: string,
): ReturnType<typeof useQuery<CustomerMaterial>> {
  return useQuery({
    queryKey: materialKeys.customer.detail(id),
    queryFn: () => api.get<CustomerMaterial>(`/api/v1/materials/customer/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateCustomerMaterial(): ReturnType<
  typeof useMutation<CustomerMaterial, Error, Record<string, unknown>>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<CustomerMaterial>("/api/v1/materials/customer", data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: materialKeys.customer.lists() });
    },
  });
}

export function useUpdateCustomerMaterial(
  id: string,
): ReturnType<typeof useMutation<CustomerMaterial, Error, Record<string, unknown>>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put<CustomerMaterial>(`/api/v1/materials/customer/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: materialKeys.customer.lists() });
      void qc.invalidateQueries({ queryKey: materialKeys.customer.detail(id) });
    },
  });
}

export function useDeleteCustomerMaterial(): ReturnType<
  typeof useMutation<{ id: string }, Error, string>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/api/v1/materials/customer/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: materialKeys.customer.lists() });
    },
  });
}

// ── Disposal materials ──

export function useDisposalMaterials(
  params: MaterialListParams = {},
): ReturnType<typeof useQuery<PaginatedResponse<DisposalMaterial>>> {
  return useQuery({
    queryKey: materialKeys.disposal.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<DisposalMaterial>>(
        `/api/v1/materials/disposal${buildQueryString(params)}`,
      ),
  });
}

export function useDisposalMaterial(
  id: string,
): ReturnType<typeof useQuery<DisposalMaterial>> {
  return useQuery({
    queryKey: materialKeys.disposal.detail(id),
    queryFn: () => api.get<DisposalMaterial>(`/api/v1/materials/disposal/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateDisposalMaterial(): ReturnType<
  typeof useMutation<DisposalMaterial, Error, Record<string, unknown>>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<DisposalMaterial>("/api/v1/materials/disposal", data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: materialKeys.disposal.lists() });
    },
  });
}

export function useUpdateDisposalMaterial(
  id: string,
): ReturnType<typeof useMutation<DisposalMaterial, Error, Record<string, unknown>>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put<DisposalMaterial>(`/api/v1/materials/disposal/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: materialKeys.disposal.lists() });
      void qc.invalidateQueries({ queryKey: materialKeys.disposal.detail(id) });
    },
  });
}

export function useDeleteDisposalMaterial(): ReturnType<
  typeof useMutation<{ id: string }, Error, string>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/api/v1/materials/disposal/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: materialKeys.disposal.lists() });
    },
  });
}

// ── Disposal site settings ──

export function useDisposalSiteSettings(
  addressId: string,
): ReturnType<typeof useQuery<DisposalSiteSettings | null>> {
  return useQuery({
    queryKey: materialKeys.siteSettings(addressId),
    queryFn: () =>
      api.get<DisposalSiteSettings | null>(
        `/api/v1/materials/disposal-site-settings/${addressId}`,
      ),
    enabled: Boolean(addressId),
  });
}

export function useUpdateDisposalSiteSettings(
  addressId: string,
): ReturnType<
  typeof useMutation<DisposalSiteSettings, Error, Record<string, unknown>>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put<DisposalSiteSettings>(
        `/api/v1/materials/disposal-site-settings/${addressId}`,
        data,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: materialKeys.siteSettings(addressId),
      });
    },
  });
}
