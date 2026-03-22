import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import type { PaginatedResponse } from "@nexum/shared";

// ── Types ──

export interface DocumentListItem {
  id: string;
  entityType: string;
  entityId: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: string;
  expiresAt: string | null;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
  // Joined
  entityName: string | null;
  uploadedByName: string | null;
}

export interface DocumentDetail extends DocumentListItem {
  description: string | null;
  storageKey: string;
  version: number;
  tags: string[];
  metadata: Record<string, unknown> | null;
  deletedAt: string | null;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}

export interface PublicLinkResponse {
  id: string;
  url: string;
  expiresAt: string;
}

export interface DownloadResponse {
  downloadUrl: string;
  fileName: string;
  expiresAt: string;
}

// ── Query Keys ──

const documentKeys = {
  all: ["documents"] as const,
  lists: () => [...documentKeys.all, "list"] as const,
  list: (params: DocumentListParams) => [...documentKeys.lists(), params] as const,
  details: () => [...documentKeys.all, "detail"] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
  download: (id: string) => [...documentKeys.all, "download", id] as const,
  expiring: (days: number) => [...documentKeys.all, "expiring", days] as const,
};

// ── List Documents ──

export interface DocumentListParams {
  entityType?: string;
  entityId?: string;
  documentType?: string;
  status?: string;
  search?: string;
  expiringWithinDays?: number;
  limit?: number;
  cursor?: string;
}

function buildDocumentQueryString(params: DocumentListParams): string {
  const sp = new URLSearchParams();
  if (params.entityType) sp.set("entityType", params.entityType);
  if (params.entityId) sp.set("entityId", params.entityId);
  if (params.documentType) sp.set("documentType", params.documentType);
  if (params.status) sp.set("status", params.status);
  if (params.search) sp.set("search", params.search);
  if (params.expiringWithinDays != null) sp.set("expiringWithinDays", String(params.expiringWithinDays));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.cursor) sp.set("cursor", params.cursor);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function useDocuments(
  params: DocumentListParams = {},
): ReturnType<typeof useQuery<PaginatedResponse<DocumentListItem>>> {
  return useQuery({
    queryKey: documentKeys.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<DocumentListItem>>(
        `/api/v1/documents${buildDocumentQueryString(params)}`,
      ),
  });
}

export function useDocument(
  id: string,
): ReturnType<typeof useQuery<DocumentDetail>> {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => api.get<DocumentDetail>(`/api/v1/documents/${id}`),
    enabled: Boolean(id),
  });
}

export function useDocumentDownload(
  id: string,
): ReturnType<typeof useQuery<DownloadResponse>> {
  return useQuery({
    queryKey: documentKeys.download(id),
    queryFn: () => api.get<DownloadResponse>(`/api/v1/documents/${id}/download`),
    enabled: Boolean(id),
  });
}

export function useExpiringDocuments(
  days: number,
): ReturnType<typeof useQuery<PaginatedResponse<DocumentListItem>>> {
  return useQuery({
    queryKey: documentKeys.expiring(days),
    queryFn: () =>
      api.get<PaginatedResponse<DocumentListItem>>(
        `/api/v1/documents/expiring?days=${days}`,
      ),
  });
}

// ── Mutations ──

export interface UploadUrlInput {
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export function useUploadUrl(): ReturnType<
  typeof useMutation<UploadUrlResponse, Error, UploadUrlInput>
> {
  return useMutation({
    mutationFn: (data: UploadUrlInput) =>
      api.post<UploadUrlResponse>("/api/v1/documents/upload-url", data),
  });
}

export interface CreateDocumentInput {
  entityType: string;
  entityId: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  description?: string;
  expiresAt?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export function useCreateDocument(): ReturnType<
  typeof useMutation<DocumentListItem, Error, CreateDocumentInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDocumentInput) =>
      api.post<DocumentListItem>("/api/v1/documents", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}

export interface UpdateDocumentInput {
  documentType?: string;
  description?: string;
  expiresAt?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export function useUpdateDocument(
  id: string,
): ReturnType<typeof useMutation<DocumentListItem, Error, UpdateDocumentInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateDocumentInput) =>
      api.put<DocumentListItem>(`/api/v1/documents/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
    },
  });
}

export function useDeleteDocument(): ReturnType<
  typeof useMutation<{ id: string }, Error, string>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/api/v1/documents/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}

export interface CreatePublicLinkInput {
  documentId: string;
  expiresInHours?: number;
  password?: string;
}

export function useCreatePublicLink(): ReturnType<
  typeof useMutation<PublicLinkResponse, Error, CreatePublicLinkInput>
> {
  return useMutation({
    mutationFn: (data: CreatePublicLinkInput) =>
      api.post<PublicLinkResponse>("/api/v1/documents/share", data),
  });
}

export function useBatchDeleteDocuments(): ReturnType<
  typeof useMutation<{ deleted: number }, Error, { documentIds: string[] }>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { documentIds: string[] }) =>
      api.post<{ deleted: number }>("/api/v1/documents/batch-delete", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}

export function useRestoreDocument(): ReturnType<
  typeof useMutation<DocumentListItem, Error, string>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<DocumentListItem>(`/api/v1/documents/${id}/restore`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}
