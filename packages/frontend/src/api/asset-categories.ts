import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";

export interface AssetSubcategory {
  id: string;
  categoryId: string;
  name: string;
  vehicleConfiguration: string | null;
  defaultVolume: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssetCategory {
  id: string;
  name: string;
  type: string;
  industryType: string;
  enableSpecifications: boolean;
  enableWeightSpecs: boolean;
  enableMassScheme: boolean;
  enableEngineHours: boolean;
  enableCapacityFields: boolean;
  enableRegistration: boolean;
  sortOrder: number;
  isActive: boolean;
  subcategories: AssetSubcategory[];
  createdAt: string;
  updatedAt: string;
}

interface CreateAssetCategoryInput {
  name: string;
  type: string;
  industryType?: string;
  enableSpecifications?: boolean;
  enableWeightSpecs?: boolean;
  enableMassScheme?: boolean;
  enableEngineHours?: boolean;
  enableCapacityFields?: boolean;
  enableRegistration?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

interface CreateSubcategoryInput {
  name: string;
  vehicleConfiguration?: string;
  defaultVolume?: number;
  sortOrder?: number;
  isActive?: boolean;
}

const categoryKeys = {
  all: ["asset-categories"] as const,
  lists: () => [...categoryKeys.all, "list"] as const,
  details: () => [...categoryKeys.all, "detail"] as const,
  detail: (id: string) => [...categoryKeys.details(), id] as const,
};

export function useAssetCategories(params?: {
  includeInactive?: boolean;
}): ReturnType<typeof useQuery<{ data: AssetCategory[] }>> {
  const searchParams = new URLSearchParams();
  if (params?.includeInactive) searchParams.set("includeInactive", "true");
  const qs = searchParams.toString();
  return useQuery({
    queryKey: categoryKeys.lists(),
    queryFn: () =>
      api.get<{ data: AssetCategory[] }>(
        `/api/v1/asset-categories${qs ? `?${qs}` : ""}`,
      ),
  });
}

export function useAssetCategory(
  id: string,
): ReturnType<typeof useQuery<AssetCategory>> {
  return useQuery({
    queryKey: categoryKeys.detail(id),
    queryFn: () => api.get<AssetCategory>(`/api/v1/asset-categories/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateAssetCategory(): ReturnType<
  typeof useMutation<AssetCategory, Error, CreateAssetCategoryInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAssetCategoryInput) =>
      api.post<AssetCategory>("/api/v1/asset-categories", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
}

export function useUpdateAssetCategory(
  id: string,
): ReturnType<
  typeof useMutation<AssetCategory, Error, Partial<CreateAssetCategoryInput>>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateAssetCategoryInput>) =>
      api.put<AssetCategory>(`/api/v1/asset-categories/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: categoryKeys.detail(id),
      });
    },
  });
}

export function useDeleteAssetCategory(): ReturnType<
  typeof useMutation<{ id: string }, Error, string>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/api/v1/asset-categories/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
}

// ── Subcategories ──

export function useCreateSubcategory(
  categoryId: string,
): ReturnType<
  typeof useMutation<AssetSubcategory, Error, CreateSubcategoryInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSubcategoryInput) =>
      api.post<AssetSubcategory>(
        `/api/v1/asset-categories/${categoryId}/subcategories`,
        data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: categoryKeys.detail(categoryId),
      });
    },
  });
}

export function useDeleteSubcategory(
  categoryId: string,
): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subcategoryId: string) =>
      api.delete<{ id: string }>(
        `/api/v1/asset-categories/${categoryId}/subcategories/${subcategoryId}`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: categoryKeys.detail(categoryId),
      });
    },
  });
}
