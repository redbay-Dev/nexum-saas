import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import type { PaginatedResponse } from "@nexum/shared";

// ── Types ──

export interface RctiListItem {
  id: string;
  rctiNumber: string;
  contractorId: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  subtotal: string;
  deductionsTotal: string;
  total: string;
  amountPaid: string;
  createdAt: string;
  contractorName: string | null;
}

export interface RctiLineItem {
  id: string;
  rctiId: string;
  lineNumber: number;
  lineType: string;
  description: string;
  quantity: string;
  unitOfMeasure: string | null;
  unitPrice: string;
  lineTotal: string;
  deductionCategory: string | null;
  deductionDetails: string | null;
  assetRegistration: string | null;
  sourceJobNumber: string | null;
}

export interface RctiPayment {
  id: string;
  rctiId: string | null;
  paymentDate: string;
  amount: string;
  paymentMethod: string;
  referenceNumber: string | null;
  createdAt: string;
}

export interface RctiDetail extends RctiListItem {
  contractorAbn: string | null;
  issueDate: string | null;
  dueDate: string | null;
  notes: string | null;
  internalNotes: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  disputedAt: string | null;
  disputeReason: string | null;
  lineItems: RctiLineItem[];
  payments: RctiPayment[];
}

// ── Query Keys ──

const rctiKeys = {
  all: ["rctis"] as const,
  lists: () => [...rctiKeys.all, "list"] as const,
  list: (params: RctiListParams) => [...rctiKeys.lists(), params] as const,
  details: () => [...rctiKeys.all, "detail"] as const,
  detail: (id: string) => [...rctiKeys.details(), id] as const,
};

export interface RctiListParams {
  search?: string;
  status?: string;
  contractorId?: string;
  periodStart?: string;
  periodEnd?: string;
  limit?: number;
  cursor?: string;
}

function buildRctiQueryString(params: RctiListParams): string {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.status) sp.set("status", params.status);
  if (params.contractorId) sp.set("contractorId", params.contractorId);
  if (params.periodStart) sp.set("periodStart", params.periodStart);
  if (params.periodEnd) sp.set("periodEnd", params.periodEnd);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.cursor) sp.set("cursor", params.cursor);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function useRctis(
  params: RctiListParams = {},
): ReturnType<typeof useQuery<PaginatedResponse<RctiListItem>>> {
  return useQuery({
    queryKey: rctiKeys.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<RctiListItem>>(
        `/api/v1/rctis${buildRctiQueryString(params)}`,
      ),
  });
}

export function useRcti(
  id: string,
): ReturnType<typeof useQuery<RctiDetail>> {
  return useQuery({
    queryKey: rctiKeys.detail(id),
    queryFn: () => api.get<RctiDetail>(`/api/v1/rctis/${id}`),
    enabled: Boolean(id),
  });
}

export function useGenerateRcti(): ReturnType<
  typeof useMutation<RctiListItem, Error, { contractorId: string; periodStart: string; periodEnd: string }>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { contractorId: string; periodStart: string; periodEnd: string }) =>
      api.post<RctiListItem>("/api/v1/rctis/generate", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rctiKeys.lists() });
    },
  });
}

export function useTransitionRcti(
  id: string,
): ReturnType<typeof useMutation<RctiListItem, Error, { status: string; reason?: string }>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { status: string; reason?: string }) =>
      api.post<RctiListItem>(`/api/v1/rctis/${id}/transition`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rctiKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: rctiKeys.detail(id) });
    },
  });
}

export function useApproveRcti(
  id: string,
): ReturnType<typeof useMutation<RctiListItem, Error, { notes?: string }>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { notes?: string }) =>
      api.post<RctiListItem>(`/api/v1/rctis/${id}/approve`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rctiKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: rctiKeys.detail(id) });
    },
  });
}

export function useAddRctiDeduction(
  rctiId: string,
): ReturnType<typeof useMutation<RctiLineItem, Error, { deductionCategory: string; description: string; amount: number; details?: string }>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { deductionCategory: string; description: string; amount: number; details?: string }) =>
      api.post<RctiLineItem>(`/api/v1/rctis/${rctiId}/deductions`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rctiKeys.detail(rctiId) });
    },
  });
}

export function useDeleteRctiDeduction(
  rctiId: string,
): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) =>
      api.delete<{ id: string }>(`/api/v1/rctis/${rctiId}/deductions/${lineId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rctiKeys.detail(rctiId) });
    },
  });
}

export function useRecordRctiPayment(
  id: string,
): ReturnType<typeof useMutation<RctiPayment, Error, { paymentDate: string; amount: number; paymentMethod: string; referenceNumber?: string; notes?: string }>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { paymentDate: string; amount: number; paymentMethod: string; referenceNumber?: string; notes?: string }) =>
      api.post<RctiPayment>(`/api/v1/rctis/${id}/payments`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rctiKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: rctiKeys.detail(id) });
    },
  });
}
