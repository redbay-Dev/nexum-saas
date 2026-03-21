import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import type { PaginatedResponse } from "@nexum/shared";

export interface JobTypeVisibleSections {
  locations: boolean;
  materials: boolean;
  assetRequirements: boolean;
  pricing: boolean;
  scheduling: boolean;
}

export interface JobTypeRequiredFields {
  poNumber: boolean;
  materials: boolean;
  locations: boolean;
}

export interface JobTypeDefaults {
  priority?: string;
  durationHours?: number;
  assetCategoryId?: string;
}

export interface JobType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isSystem: boolean;
  visibleSections: JobTypeVisibleSections | null;
  requiredFields: JobTypeRequiredFields | null;
  availablePricingMethods: string[] | null;
  defaults: JobTypeDefaults | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JobTypeListParams {
  search?: string;
  isActive?: boolean;
  limit?: number;
  cursor?: string;
}

interface CreateJobTypeInput {
  name: string;
  code: string;
  description?: string;
  visibleSections?: Partial<JobTypeVisibleSections>;
  requiredFields?: Partial<JobTypeRequiredFields>;
  availablePricingMethods?: string[];
  defaults?: Partial<JobTypeDefaults>;
  sortOrder?: number;
  isActive?: boolean;
}

const jobTypeKeys = {
  all: ["jobTypes"] as const,
  lists: () => [...jobTypeKeys.all, "list"] as const,
  list: (params: JobTypeListParams) => [...jobTypeKeys.lists(), params] as const,
  details: () => [...jobTypeKeys.all, "detail"] as const,
  detail: (id: string) => [...jobTypeKeys.details(), id] as const,
};

function buildQueryString(params: JobTypeListParams): string {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.isActive !== undefined) sp.set("isActive", String(params.isActive));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.cursor) sp.set("cursor", params.cursor);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function useJobTypes(
  params: JobTypeListParams = {},
): ReturnType<typeof useQuery<PaginatedResponse<JobType>>> {
  return useQuery({
    queryKey: jobTypeKeys.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<JobType>>(
        `/api/v1/job-types${buildQueryString(params)}`,
      ),
  });
}

export function useJobType(
  id: string,
): ReturnType<typeof useQuery<JobType>> {
  return useQuery({
    queryKey: jobTypeKeys.detail(id),
    queryFn: () => api.get<JobType>(`/api/v1/job-types/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateJobType(): ReturnType<
  typeof useMutation<JobType, Error, CreateJobTypeInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateJobTypeInput) =>
      api.post<JobType>("/api/v1/job-types", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobTypeKeys.lists() });
    },
  });
}

export function useUpdateJobType(
  id: string,
): ReturnType<typeof useMutation<JobType, Error, Partial<CreateJobTypeInput>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateJobTypeInput>) =>
      api.put<JobType>(`/api/v1/job-types/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobTypeKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: jobTypeKeys.detail(id) });
    },
  });
}

export function useDeleteJobType(): ReturnType<
  typeof useMutation<{ id: string }, Error, string>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/api/v1/job-types/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobTypeKeys.lists() });
    },
  });
}
