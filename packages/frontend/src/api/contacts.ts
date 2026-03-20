import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import type { PaginatedResponse } from "@nexum/shared";

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  companyId: string | null;
  addressId: string | null;
  preferredContactMethod: string;
  smsOptIn: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactListParams {
  search?: string;
  companyId?: string;
  addressId?: string;
  status?: "active" | "inactive";
  limit?: number;
  cursor?: string;
}

interface CreateContactInput {
  firstName: string;
  lastName: string;
  title?: string;
  phone?: string;
  email?: string;
  companyId?: string;
  addressId?: string;
  preferredContactMethod?: "phone" | "email" | "sms";
  smsOptIn?: boolean;
  status?: string;
}

const contactKeys = {
  all: ["contacts"] as const,
  lists: () => [...contactKeys.all, "list"] as const,
  list: (params: ContactListParams) => [...contactKeys.lists(), params] as const,
  details: () => [...contactKeys.all, "detail"] as const,
  detail: (id: string) => [...contactKeys.details(), id] as const,
};

function buildQueryString(params: ContactListParams): string {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.companyId) searchParams.set("companyId", params.companyId);
  if (params.addressId) searchParams.set("addressId", params.addressId);
  if (params.status) searchParams.set("status", params.status);
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.cursor) searchParams.set("cursor", params.cursor);
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

export function useContacts(params: ContactListParams = {}): ReturnType<typeof useQuery<PaginatedResponse<Contact>>> {
  return useQuery({
    queryKey: contactKeys.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<Contact>>(
        `/api/v1/contacts${buildQueryString(params)}`,
      ),
  });
}

export function useContact(id: string): ReturnType<typeof useQuery<Contact>> {
  return useQuery({
    queryKey: contactKeys.detail(id),
    queryFn: () => api.get<Contact>(`/api/v1/contacts/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateContact(): ReturnType<typeof useMutation<Contact, Error, CreateContactInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateContactInput) =>
      api.post<Contact>("/api/v1/contacts", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
    },
  });
}

export function useUpdateContact(id: string): ReturnType<typeof useMutation<Contact, Error, Partial<CreateContactInput>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateContactInput>) =>
      api.put<Contact>(`/api/v1/contacts/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: contactKeys.detail(id) });
    },
  });
}

export function useDeleteContact(): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/api/v1/contacts/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
    },
  });
}
