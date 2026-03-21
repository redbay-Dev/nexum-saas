import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import type { UserRole, UserAccountStatus } from "@nexum/shared";

// ── Types ──

export interface TenantUser {
  id: string;
  userId: string;
  displayName: string | null;
  email: string | null;
  role: string;
  isOwner: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// ── Query Keys ──

const userKeys = {
  all: ["users"] as const,
};

// ── Hooks ──

export function useUsers(): ReturnType<typeof useQuery<TenantUser[]>> {
  return useQuery({
    queryKey: userKeys.all,
    queryFn: () => api.get<TenantUser[]>("/api/v1/users"),
  });
}

export function useUpdateUserRole(): ReturnType<
  typeof useMutation<TenantUser, Error, { userId: string; role: UserRole }>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      api.put<TenantUser>(`/api/v1/users/${userId}/role`, { role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

export function useUpdateUserStatus(): ReturnType<
  typeof useMutation<TenantUser, Error, { userId: string; status: UserAccountStatus }>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: UserAccountStatus }) =>
      api.put<TenantUser>(`/api/v1/users/${userId}/status`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}
