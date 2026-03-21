import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import type { PaginatedResponse } from "@nexum/shared";
import type { JobTypeVisibleSections } from "@frontend/api/job-types.js";

// ── Types ──

export interface JobListItem {
  id: string;
  jobNumber: string;
  name: string;
  jobTypeId: string;
  customerId: string | null;
  projectId: string | null;
  poNumber: string | null;
  priority: string;
  status: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined
  jobTypeName: string | null;
  jobTypeCode: string | null;
  customerName: string | null;
}

export interface JobLocation {
  id: string;
  jobId: string;
  locationType: string;
  addressId: string;
  entryPointId: string | null;
  sequence: number;
  contactName: string | null;
  contactPhone: string | null;
  instructions: string | null;
  tipFee: string | null;
  arrivalTime: string | null;
  departureTime: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined
  addressStreet: string | null;
  addressSuburb: string | null;
  addressState: string | null;
  entryPointName: string | null;
}

export interface JobMaterial {
  id: string;
  jobId: string;
  materialSourceType: string;
  materialSourceId: string;
  materialNameSnapshot: string;
  materialCategorySnapshot: string | null;
  materialComplianceSnapshot: Record<string, unknown> | null;
  quantity: string | null;
  unitOfMeasure: string | null;
  flowType: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobAssetRequirement {
  id: string;
  jobId: string;
  assetCategoryId: string;
  assetSubcategoryId: string | null;
  quantity: number;
  payloadLimit: string | null;
  specialRequirements: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined
  categoryName: string | null;
  subcategoryName: string | null;
}

export interface JobPricingLine {
  id: string;
  jobId: string;
  lineType: string;
  partyId: string | null;
  partyName: string | null;
  category: string;
  description: string | null;
  rateType: string;
  quantity: string;
  unitRate: string;
  total: string;
  isLocked: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobStatusHistoryEntry {
  id: string;
  jobId: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string;
  reason: string | null;
  createdAt: string;
}

export interface JobDetail extends JobListItem {
  salesRepId: string | null;
  jobLeadId: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  isMultiDay: boolean;
  minimumChargeHours: string | null;
  externalNotes: string | null;
  internalNotes: string | null;
  cancellationReason: string | null;
  metadata: Record<string, unknown> | null;
  createdBy: string | null;
  // Joined
  jobTypeVisibleSections: JobTypeVisibleSections | null;
  projectName: string | null;
  projectNumber: string | null;
  // Sub-resources
  locations: JobLocation[];
  materials: JobMaterial[];
  assetRequirements: JobAssetRequirement[];
  pricingLines: JobPricingLine[];
  statusHistory: JobStatusHistoryEntry[];
}

export interface JobListParams {
  search?: string;
  status?: string;
  jobTypeId?: string;
  customerId?: string;
  projectId?: string;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  cursor?: string;
}

interface CreateJobInput {
  name: string;
  jobTypeId: string;
  customerId?: string;
  projectId?: string;
  poNumber?: string;
  priority?: string;
  salesRepId?: string;
  jobLeadId?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  isMultiDay?: boolean;
  minimumChargeHours?: number;
  externalNotes?: string;
  internalNotes?: string;
  metadata?: Record<string, unknown>;
}

// ── Query Keys ──

const jobKeys = {
  all: ["jobs"] as const,
  lists: () => [...jobKeys.all, "list"] as const,
  list: (params: JobListParams) => [...jobKeys.lists(), params] as const,
  details: () => [...jobKeys.all, "detail"] as const,
  detail: (id: string) => [...jobKeys.details(), id] as const,
};

function buildQueryString(params: JobListParams): string {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.status) sp.set("status", params.status);
  if (params.jobTypeId) sp.set("jobTypeId", params.jobTypeId);
  if (params.customerId) sp.set("customerId", params.customerId);
  if (params.projectId) sp.set("projectId", params.projectId);
  if (params.priority) sp.set("priority", params.priority);
  if (params.dateFrom) sp.set("dateFrom", params.dateFrom);
  if (params.dateTo) sp.set("dateTo", params.dateTo);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.cursor) sp.set("cursor", params.cursor);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

// ── Hooks ──

export function useJobs(
  params: JobListParams = {},
): ReturnType<typeof useQuery<PaginatedResponse<JobListItem>>> {
  return useQuery({
    queryKey: jobKeys.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<JobListItem>>(
        `/api/v1/jobs${buildQueryString(params)}`,
      ),
  });
}

export function useJob(
  id: string,
): ReturnType<typeof useQuery<JobDetail>> {
  return useQuery({
    queryKey: jobKeys.detail(id),
    queryFn: () => api.get<JobDetail>(`/api/v1/jobs/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateJob(): ReturnType<
  typeof useMutation<JobListItem, Error, CreateJobInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateJobInput) =>
      api.post<JobListItem>("/api/v1/jobs", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
}

export function useUpdateJob(
  id: string,
): ReturnType<typeof useMutation<JobListItem, Error, Partial<CreateJobInput>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateJobInput>) =>
      api.put<JobListItem>(`/api/v1/jobs/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(id) });
    },
  });
}

export function useDeleteJob(): ReturnType<
  typeof useMutation<{ id: string }, Error, string>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/api/v1/jobs/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
}

export function useJobStatusTransition(
  id: string,
): ReturnType<
  typeof useMutation<JobListItem, Error, { status: string; reason?: string }>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { status: string; reason?: string }) =>
      api.post<JobListItem>(`/api/v1/jobs/${id}/status`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(id) });
    },
  });
}

// ── Sub-resource mutations ──

export function useCreateJobLocation(
  jobId: string,
): ReturnType<typeof useMutation<JobLocation, Error, Record<string, unknown>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<JobLocation>(`/api/v1/jobs/${jobId}/locations`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
    },
  });
}

export function useDeleteJobLocation(
  jobId: string,
): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subId: string) =>
      api.delete<{ id: string }>(`/api/v1/jobs/${jobId}/locations/${subId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
    },
  });
}

export function useCreateJobMaterial(
  jobId: string,
): ReturnType<typeof useMutation<JobMaterial, Error, Record<string, unknown>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<JobMaterial>(`/api/v1/jobs/${jobId}/materials`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
    },
  });
}

export function useDeleteJobMaterial(
  jobId: string,
): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subId: string) =>
      api.delete<{ id: string }>(`/api/v1/jobs/${jobId}/materials/${subId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
    },
  });
}

export function useCreateJobAssetRequirement(
  jobId: string,
): ReturnType<typeof useMutation<JobAssetRequirement, Error, Record<string, unknown>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<JobAssetRequirement>(`/api/v1/jobs/${jobId}/asset-requirements`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
    },
  });
}

export function useDeleteJobAssetRequirement(
  jobId: string,
): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subId: string) =>
      api.delete<{ id: string }>(`/api/v1/jobs/${jobId}/asset-requirements/${subId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
    },
  });
}

export function useCreateJobPricingLine(
  jobId: string,
): ReturnType<typeof useMutation<JobPricingLine, Error, Record<string, unknown>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<JobPricingLine>(`/api/v1/jobs/${jobId}/pricing-lines`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
    },
  });
}

export function useDeleteJobPricingLine(
  jobId: string,
): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subId: string) =>
      api.delete<{ id: string }>(`/api/v1/jobs/${jobId}/pricing-lines/${subId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
    },
  });
}
