import { useQuery } from "@tanstack/react-query";

// ── Types ──

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  previousData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
  cursor?: string;
}

// ── Query Keys ──

const auditLogKeys = {
  all: ["audit-log"] as const,
  list: (filters: AuditLogFilters) => [...auditLogKeys.all, filters] as const,
};

function buildQueryString(filters: AuditLogFilters): string {
  const sp = new URLSearchParams();
  if (filters.userId) sp.set("userId", filters.userId);
  if (filters.action) sp.set("action", filters.action);
  if (filters.entityType) sp.set("entityType", filters.entityType);
  if (filters.entityId) sp.set("entityId", filters.entityId);
  if (filters.dateFrom) sp.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) sp.set("dateTo", filters.dateTo);
  if (filters.search) sp.set("search", filters.search);
  if (filters.limit) sp.set("limit", filters.limit.toString());
  if (filters.cursor) sp.set("cursor", filters.cursor);
  const str = sp.toString();
  return str ? `?${str}` : "";
}

// ── Hooks ──

export function useAuditLog(
  filters: AuditLogFilters,
): ReturnType<typeof useQuery<AuditLogResponse>> {
  return useQuery({
    queryKey: auditLogKeys.list(filters),
    queryFn: async () => {
      const response = await fetch(`/api/v1/audit-log${buildQueryString(filters)}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to fetch audit log");
      const body = (await response.json()) as { success: boolean } & AuditLogResponse;
      return {
        data: body.data,
        nextCursor: body.nextCursor,
        hasMore: body.hasMore,
        total: body.total,
      };
    },
  });
}

export { auditLogKeys };
