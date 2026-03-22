import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import type { PaginatedResponse } from "@nexum/shared";

// ── Types ──

export interface BillingRunListItem {
  id: string;
  runNumber: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  invoiceCount: number;
  totalAmount: string;
  generatedBy: string | null;
  generatedByName: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillingRunItem {
  id: string;
  billingRunId: string;
  customerId: string;
  customerName: string | null;
  jobCount: number;
  estimatedTotal: string;
  actualTotal: string | null;
  invoiceId: string | null;
  status: string;
}

export interface BillingRunDetail extends BillingRunListItem {
  notes: string | null;
  items: BillingRunItem[];
}

export interface BillingRunPreview {
  customerCount: number;
  jobCount: number;
  estimatedTotal: string;
  items: {
    customerId: string;
    customerName: string;
    jobCount: number;
    estimatedTotal: string;
  }[];
}

// ── Query Keys ──

const billingRunKeys = {
  all: ["billing-runs"] as const,
  lists: () => [...billingRunKeys.all, "list"] as const,
  list: (params: BillingRunListParams) => [...billingRunKeys.lists(), params] as const,
  details: () => [...billingRunKeys.all, "detail"] as const,
  detail: (id: string) => [...billingRunKeys.details(), id] as const,
};

// ── List ──

export interface BillingRunListParams {
  status?: string;
  search?: string;
  limit?: number;
  cursor?: string;
}

function buildBillingRunQueryString(params: BillingRunListParams): string {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.search) sp.set("search", params.search);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.cursor) sp.set("cursor", params.cursor);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function useBillingRuns(
  params: BillingRunListParams = {},
): ReturnType<typeof useQuery<PaginatedResponse<BillingRunListItem>>> {
  return useQuery({
    queryKey: billingRunKeys.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<BillingRunListItem>>(
        `/api/v1/billing-runs${buildBillingRunQueryString(params)}`,
      ),
  });
}

export function useBillingRun(
  id: string,
): ReturnType<typeof useQuery<BillingRunDetail>> {
  return useQuery({
    queryKey: billingRunKeys.detail(id),
    queryFn: () => api.get<BillingRunDetail>(`/api/v1/billing-runs/${id}`),
    enabled: Boolean(id),
  });
}

// ── Mutations ──

export interface BillingRunPreviewInput {
  periodStart: string;
  periodEnd: string;
  customerIds?: string[];
}

export function useBillingRunPreview(): ReturnType<
  typeof useMutation<BillingRunPreview, Error, BillingRunPreviewInput>
> {
  return useMutation({
    mutationFn: (data: BillingRunPreviewInput) =>
      api.post<BillingRunPreview>("/api/v1/billing-runs/preview", data),
  });
}

export interface CreateBillingRunInput {
  periodStart: string;
  periodEnd: string;
  customerIds?: string[];
  notes?: string;
}

export function useCreateBillingRun(): ReturnType<
  typeof useMutation<BillingRunListItem, Error, CreateBillingRunInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBillingRunInput) =>
      api.post<BillingRunListItem>("/api/v1/billing-runs", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: billingRunKeys.lists() });
    },
  });
}

export function useBatchVerifyInvoices(): ReturnType<
  typeof useMutation<{ verified: number }, Error, { invoiceIds: string[] }>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { invoiceIds: string[] }) =>
      api.post<{ verified: number }>("/api/v1/billing-runs/batch-verify", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: billingRunKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: billingRunKeys.details() });
    },
  });
}

export function useBatchSendInvoices(): ReturnType<
  typeof useMutation<{ sent: number }, Error, { invoiceIds: string[] }>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { invoiceIds: string[] }) =>
      api.post<{ sent: number }>("/api/v1/billing-runs/batch-send", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: billingRunKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: billingRunKeys.details() });
    },
  });
}

export function useInvoicePdfPreview(id: string): string {
  return `/api/v1/billing-runs/invoice/${id}/pdf-preview`;
}

export interface SendRemittanceInput {
  billingRunId: string;
  contractorIds?: string[];
  emailSubject?: string;
  emailBody?: string;
}

export function useSendRemittance(): ReturnType<
  typeof useMutation<{ sent: number }, Error, SendRemittanceInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SendRemittanceInput) =>
      api.post<{ sent: number }>("/api/v1/billing-runs/send-remittance", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: billingRunKeys.lists() });
    },
  });
}
