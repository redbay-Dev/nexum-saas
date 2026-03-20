import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";

export interface MaterialSubcategory {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  densityFactor: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialCategory {
  id: string;
  name: string;
  type: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  subcategories: MaterialSubcategory[];
}

interface MaterialCategoriesResponse {
  data: MaterialCategory[];
}

const categoryKeys = {
  all: ["material-categories"] as const,
  lists: () => [...categoryKeys.all, "list"] as const,
  list: (params: { search?: string; includeInactive?: boolean }) =>
    [...categoryKeys.lists(), params] as const,
  details: () => [...categoryKeys.all, "detail"] as const,
  detail: (id: string) => [...categoryKeys.details(), id] as const,
};

export function useMaterialCategories(
  params: { search?: string; includeInactive?: boolean } = {},
): ReturnType<typeof useQuery<MaterialCategoriesResponse>> {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.includeInactive) searchParams.set("includeInactive", "true");
  const qs = searchParams.toString();
  const url = `/api/v1/material-categories${qs ? `?${qs}` : ""}`;

  return useQuery({
    queryKey: categoryKeys.list(params),
    queryFn: () => api.get<MaterialCategoriesResponse>(url),
  });
}

export function useMaterialCategory(
  id: string,
): ReturnType<typeof useQuery<MaterialCategory>> {
  return useQuery({
    queryKey: categoryKeys.detail(id),
    queryFn: () => api.get<MaterialCategory>(`/api/v1/material-categories/${id}`),
    enabled: Boolean(id),
  });
}

interface CreateCategoryInput {
  name: string;
  type: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export function useCreateMaterialCategory(): ReturnType<
  typeof useMutation<MaterialCategory, Error, CreateCategoryInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCategoryInput) =>
      api.post<MaterialCategory>("/api/v1/material-categories", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
}

export function useUpdateMaterialCategory(
  id: string,
): ReturnType<typeof useMutation<MaterialCategory, Error, Partial<CreateCategoryInput>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateCategoryInput>) =>
      api.put<MaterialCategory>(`/api/v1/material-categories/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: categoryKeys.detail(id) });
    },
  });
}

export function useDeleteMaterialCategory(): ReturnType<
  typeof useMutation<{ id: string }, Error, string>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/api/v1/material-categories/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
}

interface CreateSubcategoryInput {
  name: string;
  description?: string;
  densityFactor?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export function useCreateMaterialSubcategory(
  categoryId: string,
): ReturnType<typeof useMutation<MaterialSubcategory, Error, CreateSubcategoryInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSubcategoryInput) =>
      api.post<MaterialSubcategory>(
        `/api/v1/material-categories/${categoryId}/subcategories`,
        data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: categoryKeys.detail(categoryId) });
    },
  });
}

export function useDeleteMaterialSubcategory(
  categoryId: string,
): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subcategoryId: string) =>
      api.delete<{ id: string }>(
        `/api/v1/material-categories/${categoryId}/subcategories/${subcategoryId}`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: categoryKeys.detail(categoryId) });
    },
  });
}
