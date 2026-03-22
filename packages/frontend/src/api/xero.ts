import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import type { PaginatedResponse } from "@nexum/shared";

// ── Types ──

export interface XeroStatus {
  connected: boolean;
  organisationName: string | null;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
}

export interface XeroConnectResponse {
  authorizeUrl: string;
}

export interface XeroCallbackInput {
  code: string;
  state: string;
}

export interface XeroSettingsInput {
  autoCreateContacts?: boolean;
  autoSyncPayments?: boolean;
  pollIntervalMinutes?: number;
  defaultRevenueAccount?: string;
  defaultExpenseAccount?: string;
  syncInvoices?: boolean;
  syncBills?: boolean;
  syncContacts?: boolean;
}

export interface XeroAccount {
  accountId: string;
  code: string;
  name: string;
  type: string;
  status: string;
  taxType: string | null;
}

export interface XeroMapping {
  id: string;
  nexumEntity: string;
  nexumField: string;
  xeroEntity: string;
  xeroField: string;
  defaultValue: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface XeroContact {
  contactId: string;
  name: string;
  emailAddress: string | null;
  isLinked: boolean;
  nexumEntityId: string | null;
  nexumEntityType: string | null;
  syncStatus: string;
  lastSyncedAt: string | null;
}

export interface XeroTaxRate {
  name: string;
  taxType: string;
  effectiveRate: string;
  status: string;
}

export interface XeroTrackingCategory {
  trackingCategoryId: string;
  name: string;
  status: string;
  options: { trackingOptionId: string; name: string; status: string }[];
}

export interface XeroSyncLogItem {
  id: string;
  syncType: string;
  direction: string;
  status: string;
  entityType: string;
  entityId: string | null;
  xeroId: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  recordsProcessed: number;
  recordsFailed: number;
}

export interface XeroReconciliationItem {
  id: string;
  entityType: string;
  nexumId: string;
  xeroId: string | null;
  nexumAmount: string;
  xeroAmount: string | null;
  status: string;
  discrepancy: string | null;
  lastCheckedAt: string;
}

// ── Query Keys ──

const xeroKeys = {
  all: ["xero"] as const,
  status: () => [...xeroKeys.all, "status"] as const,
  accounts: () => [...xeroKeys.all, "accounts"] as const,
  mappings: () => [...xeroKeys.all, "mappings"] as const,
  contacts: () => [...xeroKeys.all, "contacts"] as const,
  taxRates: () => [...xeroKeys.all, "tax-rates"] as const,
  trackingCategories: () => [...xeroKeys.all, "tracking-categories"] as const,
  syncLog: (params: XeroSyncLogParams) => [...xeroKeys.all, "sync-log", params] as const,
  reconciliation: (params: XeroReconciliationParams) => [...xeroKeys.all, "reconciliation", params] as const,
};

// ── Queries ──

export function useXeroStatus(): ReturnType<typeof useQuery<XeroStatus>> {
  return useQuery({
    queryKey: xeroKeys.status(),
    queryFn: () => api.get<XeroStatus>("/api/v1/xero/status"),
  });
}

export function useXeroAccounts(): ReturnType<typeof useQuery<{ data: XeroAccount[] }>> {
  return useQuery({
    queryKey: xeroKeys.accounts(),
    queryFn: () => api.get<{ data: XeroAccount[] }>("/api/v1/xero/accounts"),
  });
}

export function useXeroMappings(): ReturnType<typeof useQuery<{ data: XeroMapping[] }>> {
  return useQuery({
    queryKey: xeroKeys.mappings(),
    queryFn: () => api.get<{ data: XeroMapping[] }>("/api/v1/xero/mappings"),
  });
}

export function useXeroContacts(): ReturnType<typeof useQuery<{ data: XeroContact[] }>> {
  return useQuery({
    queryKey: xeroKeys.contacts(),
    queryFn: () => api.get<{ data: XeroContact[] }>("/api/v1/xero/contacts"),
  });
}

export function useXeroTaxRates(): ReturnType<typeof useQuery<{ data: XeroTaxRate[] }>> {
  return useQuery({
    queryKey: xeroKeys.taxRates(),
    queryFn: () => api.get<{ data: XeroTaxRate[] }>("/api/v1/xero/tax-rates"),
  });
}

export function useXeroTrackingCategories(): ReturnType<typeof useQuery<{ data: XeroTrackingCategory[] }>> {
  return useQuery({
    queryKey: xeroKeys.trackingCategories(),
    queryFn: () => api.get<{ data: XeroTrackingCategory[] }>("/api/v1/xero/tracking-categories"),
  });
}

export interface XeroSyncLogParams {
  syncType?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  cursor?: string;
}

function buildSyncLogQueryString(params: XeroSyncLogParams): string {
  const sp = new URLSearchParams();
  if (params.syncType) sp.set("syncType", params.syncType);
  if (params.status) sp.set("status", params.status);
  if (params.dateFrom) sp.set("dateFrom", params.dateFrom);
  if (params.dateTo) sp.set("dateTo", params.dateTo);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.cursor) sp.set("cursor", params.cursor);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function useXeroSyncLog(
  params: XeroSyncLogParams = {},
): ReturnType<typeof useQuery<PaginatedResponse<XeroSyncLogItem>>> {
  return useQuery({
    queryKey: xeroKeys.syncLog(params),
    queryFn: () =>
      api.get<PaginatedResponse<XeroSyncLogItem>>(
        `/api/v1/xero/sync-log${buildSyncLogQueryString(params)}`,
      ),
  });
}

export interface XeroReconciliationParams {
  entityType?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}

function buildReconciliationQueryString(params: XeroReconciliationParams): string {
  const sp = new URLSearchParams();
  if (params.entityType) sp.set("entityType", params.entityType);
  if (params.status) sp.set("status", params.status);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.cursor) sp.set("cursor", params.cursor);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function useXeroReconciliation(
  params: XeroReconciliationParams = {},
): ReturnType<typeof useQuery<PaginatedResponse<XeroReconciliationItem>>> {
  return useQuery({
    queryKey: xeroKeys.reconciliation(params),
    queryFn: () =>
      api.get<PaginatedResponse<XeroReconciliationItem>>(
        `/api/v1/xero/reconciliation${buildReconciliationQueryString(params)}`,
      ),
  });
}

// ── Mutations ──

export function useXeroConnect(): ReturnType<
  typeof useMutation<XeroConnectResponse, Error, void>
> {
  return useMutation({
    mutationFn: () =>
      api.post<XeroConnectResponse>("/api/v1/xero/connect", {}),
  });
}

export function useXeroCallback(): ReturnType<
  typeof useMutation<XeroStatus, Error, XeroCallbackInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: XeroCallbackInput) =>
      api.post<XeroStatus>("/api/v1/xero/callback", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: xeroKeys.status() });
    },
  });
}

export function useXeroDisconnect(): ReturnType<
  typeof useMutation<{ success: boolean }, Error, void>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ success: boolean }>("/api/v1/xero/disconnect", {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: xeroKeys.all });
    },
  });
}

export function useXeroSettings(): ReturnType<
  typeof useMutation<{ success: boolean }, Error, XeroSettingsInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: XeroSettingsInput) =>
      api.put<{ success: boolean }>("/api/v1/xero/settings", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: xeroKeys.status() });
    },
  });
}

export function useXeroSyncAccounts(): ReturnType<
  typeof useMutation<{ synced: number }, Error, void>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ synced: number }>("/api/v1/xero/accounts/sync", {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: xeroKeys.accounts() });
    },
  });
}

export interface UpdateXeroMappingInput {
  nexumEntity?: string;
  nexumField?: string;
  xeroEntity?: string;
  xeroField?: string;
  defaultValue?: string | null;
  isActive?: boolean;
}

export function useUpdateXeroMapping(
  id: string,
): ReturnType<typeof useMutation<XeroMapping, Error, UpdateXeroMappingInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateXeroMappingInput) =>
      api.put<XeroMapping>(`/api/v1/xero/mappings/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: xeroKeys.mappings() });
    },
  });
}

export interface CreateXeroMappingInput {
  nexumEntity: string;
  nexumField: string;
  xeroEntity: string;
  xeroField: string;
  defaultValue?: string | null;
  isActive?: boolean;
}

export function useCreateXeroMapping(): ReturnType<
  typeof useMutation<XeroMapping, Error, CreateXeroMappingInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateXeroMappingInput) =>
      api.post<XeroMapping>("/api/v1/xero/mappings", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: xeroKeys.mappings() });
    },
  });
}

export interface XeroLinkContactInput {
  xeroContactId: string;
  nexumEntityId: string;
  nexumEntityType: string;
}

export function useXeroLinkContact(): ReturnType<
  typeof useMutation<XeroContact, Error, XeroLinkContactInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: XeroLinkContactInput) =>
      api.post<XeroContact>("/api/v1/xero/contacts/link", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: xeroKeys.contacts() });
    },
  });
}

export function useXeroSyncContacts(): ReturnType<
  typeof useMutation<{ synced: number }, Error, void>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ synced: number }>("/api/v1/xero/contacts/sync", {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: xeroKeys.contacts() });
    },
  });
}

export interface XeroSyncInvoicesInput {
  invoiceIds?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export function useXeroSyncInvoices(): ReturnType<
  typeof useMutation<{ synced: number; failed: number }, Error, XeroSyncInvoicesInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: XeroSyncInvoicesInput) =>
      api.post<{ synced: number; failed: number }>("/api/v1/xero/sync/invoices", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: xeroKeys.syncLog({}) });
    },
  });
}

export interface XeroSyncBillsInput {
  billIds?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export function useXeroSyncBills(): ReturnType<
  typeof useMutation<{ synced: number; failed: number }, Error, XeroSyncBillsInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: XeroSyncBillsInput) =>
      api.post<{ synced: number; failed: number }>("/api/v1/xero/sync/bills", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: xeroKeys.syncLog({}) });
    },
  });
}
