import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import type { PaginatedResponse } from "@nexum/shared";

export interface Project {
  id: string;
  projectNumber: string;
  name: string;
  customerId: string | null;
  startDate: string | null;
  endDate: string | null;
  salesRepId: string | null;
  projectLeadId: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined
  customerName: string | null;
}

export interface ProjectListParams {
  search?: string;
  status?: string;
  customerId?: string;
  limit?: number;
  cursor?: string;
}

interface CreateProjectInput {
  name: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  salesRepId?: string;
  projectLeadId?: string;
  status?: string;
  notes?: string;
}

const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (params: ProjectListParams) => [...projectKeys.lists(), params] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

function buildQueryString(params: ProjectListParams): string {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.status) sp.set("status", params.status);
  if (params.customerId) sp.set("customerId", params.customerId);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.cursor) sp.set("cursor", params.cursor);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function useProjects(
  params: ProjectListParams = {},
): ReturnType<typeof useQuery<PaginatedResponse<Project>>> {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<Project>>(
        `/api/v1/projects${buildQueryString(params)}`,
      ),
  });
}

export function useProject(
  id: string,
): ReturnType<typeof useQuery<Project>> {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => api.get<Project>(`/api/v1/projects/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateProject(): ReturnType<
  typeof useMutation<Project, Error, CreateProjectInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectInput) =>
      api.post<Project>("/api/v1/projects", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useUpdateProject(
  id: string,
): ReturnType<typeof useMutation<Project, Error, Partial<CreateProjectInput>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateProjectInput>) =>
      api.put<Project>(`/api/v1/projects/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
    },
  });
}

export function useDeleteProject(): ReturnType<
  typeof useMutation<{ id: string }, Error, string>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/api/v1/projects/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}
