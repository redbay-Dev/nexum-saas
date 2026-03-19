import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import type { PaginatedResponse } from "@nexum/shared";

// ── Types (matching backend response shapes) ──

export interface Company {
  id: string;
  name: string;
  tradingName: string | null;
  abn: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  isCustomer: boolean;
  isContractor: boolean;
  isSupplier: boolean;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyListParams {
  search?: string;
  role?: "customer" | "contractor" | "supplier";
  status?: "active" | "on_hold" | "archived";
  limit?: number;
  cursor?: string;
}

interface CreateCompanyInput {
  name: string;
  tradingName?: string;
  abn?: string;
  phone?: string;
  email?: string;
  website?: string;
  roles: string[];
  status?: string;
  notes?: string;
}

// ── Query Keys ──

const companyKeys = {
  all: ["companies"] as const,
  lists: () => [...companyKeys.all, "list"] as const,
  list: (params: CompanyListParams) => [...companyKeys.lists(), params] as const,
  details: () => [...companyKeys.all, "detail"] as const,
  detail: (id: string) => [...companyKeys.details(), id] as const,
};

// ── Hooks ──

function buildQueryString(params: CompanyListParams): string {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.role) searchParams.set("role", params.role);
  if (params.status) searchParams.set("status", params.status);
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.cursor) searchParams.set("cursor", params.cursor);
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

export function useCompanies(params: CompanyListParams = {}): ReturnType<typeof useQuery<PaginatedResponse<Company>>> {
  return useQuery({
    queryKey: companyKeys.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<Company>>(
        `/api/v1/companies${buildQueryString(params)}`,
      ),
  });
}

export function useCompany(id: string): ReturnType<typeof useQuery<Company>> {
  return useQuery({
    queryKey: companyKeys.detail(id),
    queryFn: () => api.get<Company>(`/api/v1/companies/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateCompany(): ReturnType<typeof useMutation<Company, Error, CreateCompanyInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCompanyInput) =>
      api.post<Company>("/api/v1/companies", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: companyKeys.lists() });
    },
  });
}

export function useUpdateCompany(id: string): ReturnType<typeof useMutation<Company, Error, Partial<CreateCompanyInput>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateCompanyInput>) =>
      api.put<Company>(`/api/v1/companies/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: companyKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: companyKeys.detail(id) });
    },
  });
}

export function useDeleteCompany(): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/api/v1/companies/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: companyKeys.lists() });
    },
  });
}
