import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import type { PaginatedResponse } from "@nexum/shared";

// ── Types ──

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  customerId: string;
  status: string;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  total: string;
  amountPaid: string;
  groupingMode: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined
  customerName: string | null;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  lineNumber: number;
  chargeId: string | null;
  jobId: string | null;
  description: string;
  quantity: string;
  unitOfMeasure: string | null;
  unitPrice: string;
  lineTotal: string;
  accountCode: string | null;
  calculationMethod: string | null;
  sourceJobNumber: string | null;
  sourceDocketNumber: string | null;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string | null;
  paymentDate: string;
  amount: string;
  paymentMethod: string;
  referenceNumber: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface InvoiceDetail extends InvoiceListItem {
  customerAbn: string | null;
  projectName: string | null;
  poNumber: string | null;
  internalNotes: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  verificationNotes: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  sentAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  lineItems: InvoiceLineItem[];
  payments: InvoicePayment[];
}

export interface ArQueueItem {
  id: string;
  jobNumber: string | null;
  name: string;
  customerId: string;
  status: string;
  updatedAt: string;
  customerName: string | null;
  projectName: string | null;
  arStatus: string;
}

// ── Query Keys ──

const invoiceKeys = {
  all: ["invoices"] as const,
  lists: () => [...invoiceKeys.all, "list"] as const,
  list: (params: InvoiceListParams) => [...invoiceKeys.lists(), params] as const,
  details: () => [...invoiceKeys.all, "detail"] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
  arQueue: () => [...invoiceKeys.all, "ar-queue"] as const,
};

// ── List Invoices ──

export interface InvoiceListParams {
  search?: string;
  status?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  overdue?: string;
  limit?: number;
  cursor?: string;
}

function buildInvoiceQueryString(params: InvoiceListParams): string {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.status) sp.set("status", params.status);
  if (params.customerId) sp.set("customerId", params.customerId);
  if (params.dateFrom) sp.set("dateFrom", params.dateFrom);
  if (params.dateTo) sp.set("dateTo", params.dateTo);
  if (params.overdue) sp.set("overdue", params.overdue);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.cursor) sp.set("cursor", params.cursor);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function useInvoices(
  params: InvoiceListParams = {},
): ReturnType<typeof useQuery<PaginatedResponse<InvoiceListItem>>> {
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<InvoiceListItem>>(
        `/api/v1/invoices${buildInvoiceQueryString(params)}`,
      ),
  });
}

export function useInvoice(
  id: string,
): ReturnType<typeof useQuery<InvoiceDetail>> {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => api.get<InvoiceDetail>(`/api/v1/invoices/${id}`),
    enabled: Boolean(id),
  });
}

// ── Mutations ──

export interface CreateInvoiceInput {
  customerId: string;
  chargeIds: string[];
  issueDate: string;
  dueDate?: string;
  groupingMode?: string;
  projectId?: string;
  poNumber?: string;
  notes?: string;
  internalNotes?: string;
}

export function useCreateInvoice(): ReturnType<
  typeof useMutation<InvoiceListItem, Error, CreateInvoiceInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInvoiceInput) =>
      api.post<InvoiceListItem>("/api/v1/invoices", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
  });
}

export function useUpdateInvoice(
  id: string,
): ReturnType<typeof useMutation<InvoiceListItem, Error, { issueDate?: string; dueDate?: string; notes?: string; internalNotes?: string }>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { issueDate?: string; dueDate?: string; notes?: string; internalNotes?: string }) =>
      api.put<InvoiceListItem>(`/api/v1/invoices/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
}

export function useDeleteInvoice(): ReturnType<
  typeof useMutation<{ id: string }, Error, string>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/api/v1/invoices/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
  });
}

export function useTransitionInvoice(
  id: string,
): ReturnType<typeof useMutation<InvoiceListItem, Error, { status: string; reason?: string }>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { status: string; reason?: string }) =>
      api.post<InvoiceListItem>(`/api/v1/invoices/${id}/transition`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
}

export function useVerifyInvoice(
  id: string,
): ReturnType<typeof useMutation<InvoiceListItem, Error, { notes?: string }>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { notes?: string }) =>
      api.post<InvoiceListItem>(`/api/v1/invoices/${id}/verify`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
}

export function useRejectInvoice(
  id: string,
): ReturnType<typeof useMutation<InvoiceListItem, Error, { reason: string }>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { reason: string }) =>
      api.post<InvoiceListItem>(`/api/v1/invoices/${id}/reject`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
}

export function useRecordInvoicePayment(
  id: string,
): ReturnType<typeof useMutation<InvoicePayment, Error, { paymentDate: string; amount: number; paymentMethod: string; referenceNumber?: string; notes?: string }>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { paymentDate: string; amount: number; paymentMethod: string; referenceNumber?: string; notes?: string }) =>
      api.post<InvoicePayment>(`/api/v1/invoices/${id}/payments`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
}

// ── AR Approval Hooks ──

export function useArQueue(): ReturnType<typeof useQuery<{ data: ArQueueItem[]; nextCursor: string | null; hasMore: boolean }>> {
  return useQuery({
    queryKey: invoiceKeys.arQueue(),
    queryFn: () =>
      api.get<{ data: ArQueueItem[]; nextCursor: string | null; hasMore: boolean }>(
        "/api/v1/invoices/ar-queue",
      ),
  });
}

export function useApproveJob(): ReturnType<
  typeof useMutation<{ jobId: string; status: string }, Error, { jobId: string; decision: string; notes?: string }>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { jobId: string; decision: string; notes?: string }) =>
      api.post<{ jobId: string; status: string }>(
        `/api/v1/invoices/ar-approve/${data.jobId}`,
        { decision: data.decision, notes: data.notes },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.arQueue() });
    },
  });
}

export function useBatchApproveJobs(): ReturnType<
  typeof useMutation<{ approved: number }, Error, { jobIds: string[] }>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { jobIds: string[] }) =>
      api.post<{ approved: number }>("/api/v1/invoices/ar-batch-approve", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.arQueue() });
    },
  });
}
