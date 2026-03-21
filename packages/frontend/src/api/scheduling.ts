import { useQuery } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";

// ── Types ──

export interface SchedulingJobLocation {
  id: string;
  locationType: string;
  addressStreet: string | null;
  addressSuburb: string | null;
  sequence: number;
}

export interface SchedulingJobAssignment {
  id: string;
  assignmentType: string;
  assetId: string | null;
  employeeId: string | null;
  contractorCompanyId: string | null;
  status: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  assetRegistration: string | null;
  assetMake: string | null;
  assetModel: string | null;
  assetNumber: string | null;
  assetCategoryName: string | null;
  assetSubcategoryName: string | null;
  employeeName: string | null;
  contractorName: string | null;
}

export interface SchedulingJobRequirement {
  id: string;
  assetCategoryId: string;
  assetSubcategoryId: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
  quantity: number;
}

export interface SchedulingJob {
  id: string;
  jobNumber: string;
  name: string;
  status: string;
  priority: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  isMultiDay: boolean;
  poNumber: string | null;
  minimumChargeHours: string | null;
  internalNotes: string | null;
  jobTypeName: string | null;
  jobTypeCode: string | null;
  customerName: string | null;
  customerId: string | null;
  projectName: string | null;
  projectId: string | null;
  projectNumber: string | null;
  locations: SchedulingJobLocation[];
  assignments: SchedulingJobAssignment[];
  assetRequirements: SchedulingJobRequirement[];
  assignmentCount: number;
}

export interface SchedulingSummary {
  total: number;
  allocated: number;
  unallocated: number;
  assignmentCount: number;
}

export interface SchedulingResponse {
  date: string;
  jobs: SchedulingJob[];
  summary: SchedulingSummary;
}

export interface ConflictJob {
  jobId: string;
  jobNumber: string;
  jobName: string;
  customerName: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

export interface ConflictEntry {
  resourceType: "asset" | "driver";
  resourceId: string;
  resourceLabel: string;
  jobs: ConflictJob[];
}

export interface ConflictsResponse {
  date: string;
  conflicts: ConflictEntry[];
}

export interface SchedulingResourceAsset {
  id: string;
  registrationNumber: string | null;
  fleetNumber: string | null;
  make: string | null;
  model: string | null;
  status: string;
  categoryName: string | null;
  subcategoryName: string | null;
  allocationCount: number;
}

export interface SchedulingResourceDriver {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  allocationCount: number;
}

export interface SchedulingResourcesResponse {
  assets?: SchedulingResourceAsset[];
  drivers?: SchedulingResourceDriver[];
}

// ── Query Params ──

export interface SchedulingParams {
  date: string;
  search?: string;
  status?: string;
  priority?: string;
  customerId?: string;
  projectId?: string;
  jobTypeId?: string;
  allocationStatus?: "all" | "allocated" | "unallocated";
  groupBy?: "customer" | "project" | "none";
}

// ── Query Keys ──

const schedulingKeys = {
  all: ["scheduling"] as const,
  list: (params: SchedulingParams) => [...schedulingKeys.all, "list", params] as const,
  conflicts: (date: string) => [...schedulingKeys.all, "conflicts", date] as const,
  resources: (date: string, type?: string) => [...schedulingKeys.all, "resources", date, type] as const,
};

function buildQueryString(params: SchedulingParams): string {
  const sp = new URLSearchParams();
  sp.set("date", params.date);
  if (params.search) sp.set("search", params.search);
  if (params.status) sp.set("status", params.status);
  if (params.priority) sp.set("priority", params.priority);
  if (params.customerId) sp.set("customerId", params.customerId);
  if (params.projectId) sp.set("projectId", params.projectId);
  if (params.jobTypeId) sp.set("jobTypeId", params.jobTypeId);
  if (params.allocationStatus && params.allocationStatus !== "all") {
    sp.set("allocationStatus", params.allocationStatus);
  }
  if (params.groupBy) sp.set("groupBy", params.groupBy);
  return `?${sp.toString()}`;
}

// ── Hooks ──

export function useSchedulingJobs(
  params: SchedulingParams,
): ReturnType<typeof useQuery<SchedulingResponse>> {
  return useQuery({
    queryKey: schedulingKeys.list(params),
    queryFn: () =>
      api.get<SchedulingResponse>(
        `/api/v1/scheduling${buildQueryString(params)}`,
      ),
    enabled: Boolean(params.date),
  });
}

export function useSchedulingConflicts(
  date: string,
): ReturnType<typeof useQuery<ConflictsResponse>> {
  return useQuery({
    queryKey: schedulingKeys.conflicts(date),
    queryFn: () =>
      api.get<ConflictsResponse>(`/api/v1/scheduling/conflicts?date=${date}`),
    enabled: Boolean(date),
  });
}

export function useSchedulingResources(
  date: string,
  type?: "assets" | "drivers",
): ReturnType<typeof useQuery<SchedulingResourcesResponse>> {
  const typeParam = type ? `&type=${type}` : "";
  return useQuery({
    queryKey: schedulingKeys.resources(date, type),
    queryFn: () =>
      api.get<SchedulingResourcesResponse>(
        `/api/v1/scheduling/resources?date=${date}${typeParam}`,
      ),
    enabled: Boolean(date),
  });
}

/** Invalidation helpers for use after allocating/deallocating */
export { schedulingKeys };
