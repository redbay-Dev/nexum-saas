import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import type { PaginatedResponse } from "@nexum/shared";

// ── Types ──

export interface DaysheetListItem {
  id: string;
  jobId: string;
  assignmentId: string | null;
  driverId: string | null;
  assetId: string | null;
  workDate: string;
  submissionChannel: string;
  status: string;
  loadCount: number | null;
  totalQuantity: string | null;
  totalGrossWeight: string | null;
  totalTareWeight: string | null;
  totalNetWeight: string | null;
  startTime: string | null;
  endTime: string | null;
  hoursWorked: string | null;
  overtimeHours: string | null;
  breakMinutes: number | null;
  totalBillableHours: string | null;
  isAutoProcessed: boolean;
  processedAt: string | null;
  processedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined
  jobName: string | null;
  jobNumber: string | null;
  driverName: string | null;
  assetRegistration: string | null;
  customerName: string | null;
}

export interface DaysheetLoad {
  id: string;
  daysheetId: string;
  loadNumber: number;
  materialSourceType: string | null;
  materialSourceId: string | null;
  materialName: string | null;
  unitOfMeasure: string | null;
  quantity: string | null;
  grossWeight: string | null;
  tareWeight: string | null;
  netWeight: string | null;
  docketNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DaysheetCharge {
  id: string;
  daysheetId: string;
  jobId: string;
  pricingLineId: string | null;
  lineType: string;
  partyId: string | null;
  partyName: string | null;
  category: string;
  description: string | null;
  rateType: string;
  quantity: string;
  unitRate: string;
  total: string;
  status: string;
  isOverride: boolean;
  overrideReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DaysheetOverage {
  id: string;
  daysheetId: string;
  daysheetLoadId: string | null;
  jobId: string;
  overageType: string;
  severity: string;
  actualValue: string;
  limitValue: string;
  overageAmount: string;
  overagePercent: string;
  approvalStatus: string;
  approvedBy: string | null;
  approvedAt: string | null;
  approvalNotes: string | null;
  driverId: string | null;
  assetId: string | null;
  materialName: string | null;
  createdAt: string;
}

export interface DocketListItem {
  id: string;
  jobId: string;
  daysheetId: string | null;
  docketType: string;
  docketNumber: string | null;
  status: string;
  issuerName: string | null;
  issueDate: string | null;
  materialName: string | null;
  quantity: string | null;
  grossWeight: string | null;
  tareWeight: string | null;
  netWeight: string | null;
  tipFee: string | null;
  hasDiscrepancy: boolean;
  notes: string | null;
  createdAt: string;
  // Joined
  jobName: string | null;
  jobNumber: string | null;
  customerName: string | null;
}

export interface DaysheetDetail extends DaysheetListItem {
  assetNumber: string | null;
  rejectionReason: string | null;
  internalNotes: string | null;
  loads: DaysheetLoad[];
  dockets: DocketListItem[];
  charges: DaysheetCharge[];
  overages: DaysheetOverage[];
}

export interface DaysheetListParams {
  search?: string;
  status?: string;
  jobId?: string;
  driverId?: string;
  assetId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  cursor?: string;
}

// ── Query Keys ──

const daysheetKeys = {
  all: ["daysheets"] as const,
  lists: () => [...daysheetKeys.all, "list"] as const,
  list: (params: DaysheetListParams) => [...daysheetKeys.lists(), params] as const,
  details: () => [...daysheetKeys.all, "detail"] as const,
  detail: (id: string) => [...daysheetKeys.details(), id] as const,
};

function buildDaysheetQueryString(params: DaysheetListParams): string {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.status) sp.set("status", params.status);
  if (params.jobId) sp.set("jobId", params.jobId);
  if (params.driverId) sp.set("driverId", params.driverId);
  if (params.assetId) sp.set("assetId", params.assetId);
  if (params.dateFrom) sp.set("dateFrom", params.dateFrom);
  if (params.dateTo) sp.set("dateTo", params.dateTo);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.cursor) sp.set("cursor", params.cursor);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

// ── Hooks ──

export function useDaysheets(
  params: DaysheetListParams = {},
): ReturnType<typeof useQuery<PaginatedResponse<DaysheetListItem>>> {
  return useQuery({
    queryKey: daysheetKeys.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<DaysheetListItem>>(
        `/api/v1/daysheets${buildDaysheetQueryString(params)}`,
      ),
  });
}

export function useDaysheet(
  id: string,
): ReturnType<typeof useQuery<DaysheetDetail>> {
  return useQuery({
    queryKey: daysheetKeys.detail(id),
    queryFn: () => api.get<DaysheetDetail>(`/api/v1/daysheets/${id}`),
    enabled: Boolean(id),
  });
}

interface CreateDaysheetInput {
  jobId: string;
  assignmentId?: string;
  driverId?: string;
  assetId?: string;
  workDate: string;
  submissionChannel?: string;
  loadCount?: number;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  overtimeHours?: number;
  pickupLocationId?: string;
  deliveryLocationId?: string;
  notes?: string;
  internalNotes?: string;
}

export function useCreateDaysheet(): ReturnType<
  typeof useMutation<DaysheetListItem, Error, CreateDaysheetInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDaysheetInput) =>
      api.post<DaysheetListItem>("/api/v1/daysheets", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: daysheetKeys.lists() });
    },
  });
}

export function useUpdateDaysheet(
  id: string,
): ReturnType<typeof useMutation<DaysheetListItem, Error, Partial<CreateDaysheetInput>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateDaysheetInput>) =>
      api.put<DaysheetListItem>(`/api/v1/daysheets/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: daysheetKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: daysheetKeys.detail(id) });
    },
  });
}

export function useDeleteDaysheet(): ReturnType<
  typeof useMutation<{ id: string }, Error, string>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/api/v1/daysheets/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: daysheetKeys.lists() });
    },
  });
}

export function useTransitionDaysheet(
  id: string,
): ReturnType<typeof useMutation<DaysheetListItem, Error, { status: string; reason?: string }>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { status: string; reason?: string }) =>
      api.post<DaysheetListItem>(`/api/v1/daysheets/${id}/transition`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: daysheetKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: daysheetKeys.detail(id) });
    },
  });
}

interface ProcessResult {
  daysheet: DaysheetListItem;
  charges: DaysheetCharge[];
  chargeCount: number;
}

export function useProcessDaysheet(
  id: string,
): ReturnType<typeof useMutation<ProcessResult, Error, void>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<ProcessResult>(`/api/v1/daysheets/${id}/process`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: daysheetKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: daysheetKeys.detail(id) });
    },
  });
}

interface BatchProcessResult {
  results: Array<{ daysheetId: string; status: string; chargeCount: number; error?: string }>;
  summary: { processed: number; skipped: number; errors: number; total: number };
}

export function useBatchProcessDaysheets(): ReturnType<
  typeof useMutation<BatchProcessResult, Error, { daysheetIds: string[] }>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { daysheetIds: string[] }) =>
      api.post<BatchProcessResult>("/api/v1/daysheets/batch-process", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: daysheetKeys.lists() });
    },
  });
}

interface CreateLoadInput {
  loadNumber: number;
  materialSourceType?: string;
  materialSourceId?: string;
  materialName?: string;
  unitOfMeasure?: string;
  quantity?: number;
  grossWeight?: number;
  tareWeight?: number;
  docketNumber?: string;
  notes?: string;
}

export function useAddDaysheetLoad(
  daysheetId: string,
): ReturnType<typeof useMutation<DaysheetLoad, Error, CreateLoadInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLoadInput) =>
      api.post<DaysheetLoad>(`/api/v1/daysheets/${daysheetId}/loads`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: daysheetKeys.detail(daysheetId) });
    },
  });
}

export function useUpdateDaysheetLoad(
  daysheetId: string,
  loadId: string,
): ReturnType<typeof useMutation<DaysheetLoad, Error, Partial<CreateLoadInput>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateLoadInput>) =>
      api.put<DaysheetLoad>(`/api/v1/daysheets/${daysheetId}/loads/${loadId}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: daysheetKeys.detail(daysheetId) });
    },
  });
}

export function useDeleteDaysheetLoad(
  daysheetId: string,
): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (loadId: string) =>
      api.delete<{ id: string }>(`/api/v1/daysheets/${daysheetId}/loads/${loadId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: daysheetKeys.detail(daysheetId) });
    },
  });
}

interface DetectOveragesResult {
  overages: DaysheetOverage[];
  totalOverages: number;
  pendingApproval: number;
  autoApproved: number;
}

export function useDetectOverages(
  daysheetId: string,
): ReturnType<typeof useMutation<DetectOveragesResult, Error, void>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<DetectOveragesResult>(`/api/v1/daysheets/${daysheetId}/detect-overages`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: daysheetKeys.detail(daysheetId) });
    },
  });
}

// ── Docket Hooks ──

const docketKeys = {
  all: ["dockets"] as const,
  lists: () => [...docketKeys.all, "list"] as const,
  list: (params: DocketListParams) => [...docketKeys.lists(), params] as const,
  details: () => [...docketKeys.all, "detail"] as const,
  detail: (id: string) => [...docketKeys.details(), id] as const,
};

export interface DocketListParams {
  search?: string;
  status?: string;
  jobId?: string;
  daysheetId?: string;
  docketType?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  cursor?: string;
}

function buildDocketQueryString(params: DocketListParams): string {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.status) sp.set("status", params.status);
  if (params.jobId) sp.set("jobId", params.jobId);
  if (params.daysheetId) sp.set("daysheetId", params.daysheetId);
  if (params.docketType) sp.set("docketType", params.docketType);
  if (params.dateFrom) sp.set("dateFrom", params.dateFrom);
  if (params.dateTo) sp.set("dateTo", params.dateTo);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.cursor) sp.set("cursor", params.cursor);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function useDockets(
  params: DocketListParams = {},
): ReturnType<typeof useQuery<PaginatedResponse<DocketListItem>>> {
  return useQuery({
    queryKey: docketKeys.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<DocketListItem>>(
        `/api/v1/dockets${buildDocketQueryString(params)}`,
      ),
  });
}

export function useDocket(
  id: string,
): ReturnType<typeof useQuery<DocketListItem & { files: Array<{ id: string; fileName: string; fileSize: number; mimeType: string }> }>> {
  return useQuery({
    queryKey: docketKeys.detail(id),
    queryFn: () => api.get<DocketListItem & { files: Array<{ id: string; fileName: string; fileSize: number; mimeType: string }> }>(`/api/v1/dockets/${id}`),
    enabled: Boolean(id),
  });
}

interface CreateDocketInput {
  jobId: string;
  daysheetId?: string;
  docketType: string;
  docketNumber?: string;
  issuerName?: string;
  issueDate?: string;
  materialName?: string;
  quantity?: number;
  unitOfMeasure?: string;
  grossWeight?: number;
  tareWeight?: number;
  tipFee?: number;
  environmentalLevy?: number;
  notes?: string;
  aiConfidence?: Record<string, number>;
}

export function useCreateDocket(): ReturnType<
  typeof useMutation<DocketListItem, Error, CreateDocketInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDocketInput) =>
      api.post<DocketListItem>("/api/v1/dockets", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: docketKeys.lists() });
    },
  });
}

export function useReconcileDocket(
  id: string,
): ReturnType<typeof useMutation<{ isReconciled: boolean; hasDiscrepancy: boolean; items: unknown[]; discrepancyNotes: string }, Error, void>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ isReconciled: boolean; hasDiscrepancy: boolean; items: unknown[]; discrepancyNotes: string }>(`/api/v1/dockets/${id}/reconcile`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: docketKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: docketKeys.lists() });
    },
  });
}

export function useOverageDecision(
  overageId: string,
): ReturnType<typeof useMutation<DaysheetOverage, Error, { approvalStatus: string; approvalNotes?: string }>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { approvalStatus: string; approvalNotes?: string }) =>
      api.post<DaysheetOverage>(`/api/v1/dockets/overages/${overageId}/decision`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: daysheetKeys.all });
      void queryClient.invalidateQueries({ queryKey: docketKeys.all });
    },
  });
}
