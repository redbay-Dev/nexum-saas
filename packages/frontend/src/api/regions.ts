import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import type { PaginatedResponse } from "@nexum/shared";

export interface Region {
  id: string;
  name: string;
  description: string | null;
  boundary: unknown;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegionDetail extends Region {
  addressCount: number;
}

export interface RegionListParams {
  search?: string;
  active?: boolean;
  limit?: number;
  cursor?: string;
}

interface CreateRegionInput {
  name: string;
  description?: string;
}

const regionKeys = {
  all: ["regions"] as const,
  lists: () => [...regionKeys.all, "list"] as const,
  list: (params: RegionListParams) => [...regionKeys.lists(), params] as const,
  details: () => [...regionKeys.all, "detail"] as const,
  detail: (id: string) => [...regionKeys.details(), id] as const,
};

function buildQueryString(params: RegionListParams): string {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.active !== undefined) searchParams.set("active", String(params.active));
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.cursor) searchParams.set("cursor", params.cursor);
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

export function useRegions(params: RegionListParams = {}): ReturnType<typeof useQuery<PaginatedResponse<Region>>> {
  return useQuery({
    queryKey: regionKeys.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<Region>>(
        `/api/v1/regions${buildQueryString(params)}`,
      ),
  });
}

export function useRegion(id: string): ReturnType<typeof useQuery<RegionDetail>> {
  return useQuery({
    queryKey: regionKeys.detail(id),
    queryFn: () => api.get<RegionDetail>(`/api/v1/regions/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateRegion(): ReturnType<typeof useMutation<Region, Error, CreateRegionInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRegionInput) =>
      api.post<Region>("/api/v1/regions", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: regionKeys.lists() });
    },
  });
}

export function useUpdateRegion(id: string): ReturnType<typeof useMutation<Region, Error, Partial<CreateRegionInput>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateRegionInput>) =>
      api.put<Region>(`/api/v1/regions/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: regionKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: regionKeys.detail(id) });
    },
  });
}

export function useToggleRegion(): ReturnType<typeof useMutation<Region, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.put<Region>(`/api/v1/regions/${id}/toggle`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: regionKeys.lists() });
    },
  });
}
