import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import type { PaginatedResponse } from "@nexum/shared";

// ── Types ──

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  isRead: boolean;
  readAt: string | null;
  entityType: string | null;
  entityId: string | null;
  actionUrl: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  email: boolean;
  inApp: boolean;
  sms: boolean;
  categories: Record<string, { email: boolean; inApp: boolean; sms: boolean }>;
}

export interface CommunicationLogItem {
  id: string;
  type: string;
  recipient: string;
  subject: string | null;
  status: string;
  sentAt: string;
  deliveredAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

// ── Query Keys ──

const notificationKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationKeys.all, "list"] as const,
  list: (params: NotificationListParams) => [...notificationKeys.lists(), params] as const,
  preferences: () => [...notificationKeys.all, "preferences"] as const,
  log: (params: CommunicationLogParams) => [...notificationKeys.all, "log", params] as const,
};

// ── List Notifications ──

export interface NotificationListParams {
  isRead?: boolean;
  type?: string;
  severity?: string;
  limit?: number;
  cursor?: string;
}

function buildNotificationQueryString(params: NotificationListParams): string {
  const sp = new URLSearchParams();
  if (params.isRead != null) sp.set("isRead", String(params.isRead));
  if (params.type) sp.set("type", params.type);
  if (params.severity) sp.set("severity", params.severity);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.cursor) sp.set("cursor", params.cursor);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function useNotifications(
  params: NotificationListParams = {},
): ReturnType<typeof useQuery<PaginatedResponse<NotificationItem>>> {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<NotificationItem>>(
        `/api/v1/notifications${buildNotificationQueryString(params)}`,
      ),
  });
}

// ── Preferences ──

export function useNotificationPreferences(): ReturnType<
  typeof useQuery<NotificationPreferences>
> {
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: () =>
      api.get<NotificationPreferences>("/api/v1/notifications/preferences"),
  });
}

// ── Communication Log ──

export interface CommunicationLogParams {
  type?: string;
  status?: string;
  recipient?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  cursor?: string;
}

function buildLogQueryString(params: CommunicationLogParams): string {
  const sp = new URLSearchParams();
  if (params.type) sp.set("type", params.type);
  if (params.status) sp.set("status", params.status);
  if (params.recipient) sp.set("recipient", params.recipient);
  if (params.dateFrom) sp.set("dateFrom", params.dateFrom);
  if (params.dateTo) sp.set("dateTo", params.dateTo);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.cursor) sp.set("cursor", params.cursor);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function useCommunicationLog(
  params: CommunicationLogParams = {},
): ReturnType<typeof useQuery<PaginatedResponse<CommunicationLogItem>>> {
  return useQuery({
    queryKey: notificationKeys.log(params),
    queryFn: () =>
      api.get<PaginatedResponse<CommunicationLogItem>>(
        `/api/v1/notifications/log${buildLogQueryString(params)}`,
      ),
  });
}

// ── Mutations ──

export interface MarkNotificationsInput {
  notificationIds: string[];
  isRead: boolean;
}

export function useMarkNotifications(): ReturnType<
  typeof useMutation<{ updated: number }, Error, MarkNotificationsInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MarkNotificationsInput) =>
      api.post<{ updated: number }>("/api/v1/notifications/mark", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
    },
  });
}

export function useMarkAllRead(): ReturnType<
  typeof useMutation<{ updated: number }, Error, void>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ updated: number }>("/api/v1/notifications/mark-all-read", {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
    },
  });
}

export function useUpdateNotificationPreferences(): ReturnType<
  typeof useMutation<NotificationPreferences, Error, NotificationPreferences>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: NotificationPreferences) =>
      api.put<NotificationPreferences>("/api/v1/notifications/preferences", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.preferences() });
    },
  });
}
