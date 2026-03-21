import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";

// ── Types ──

export interface CustomerRateCard {
  id: string;
  customerId: string;
  name: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RateCardEntry {
  id: string;
  rateCardId: string;
  materialSubcategoryId: string | null;
  category: string;
  rateType: string;
  unitRate: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RateCardWithEntries extends CustomerRateCard {
  entries: RateCardEntry[];
}

export interface RateLookupResult {
  rate: number;
  source: "rate_card" | "standard" | "not_found";
  rateCardEntryId?: string;
  rateCardName?: string;
}

export interface CreateRateCardInput {
  customerId: string;
  name: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive?: boolean;
  notes?: string;
}

export interface UpdateRateCardInput {
  name?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  isActive?: boolean;
  notes?: string;
}

export interface CreateRateCardEntryInput {
  materialSubcategoryId?: string;
  category: string;
  rateType: string;
  unitRate: number;
  description?: string;
  sortOrder?: number;
}

// ── Query Keys ──

const rateCardKeys = {
  all: ["rate-cards"] as const,
  list: (customerId?: string) => [...rateCardKeys.all, "list", customerId] as const,
  detail: (id: string) => [...rateCardKeys.all, "detail", id] as const,
};

// ── Hooks ──

export function useRateCards(customerId?: string): ReturnType<typeof useQuery<CustomerRateCard[]>> {
  const params = customerId ? `?customerId=${customerId}` : "";
  return useQuery({
    queryKey: rateCardKeys.list(customerId),
    queryFn: () => api.get<CustomerRateCard[]>(`/api/v1/rate-cards${params}`),
  });
}

export function useRateCard(id: string): ReturnType<typeof useQuery<RateCardWithEntries>> {
  return useQuery({
    queryKey: rateCardKeys.detail(id),
    queryFn: () => api.get<RateCardWithEntries>(`/api/v1/rate-cards/${id}`),
    enabled: !!id,
  });
}

export function useCreateRateCard(): ReturnType<typeof useMutation<CustomerRateCard, Error, CreateRateCardInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRateCardInput) => api.post<CustomerRateCard>("/api/v1/rate-cards", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rateCardKeys.all });
    },
  });
}

export function useUpdateRateCard(id: string): ReturnType<typeof useMutation<CustomerRateCard, Error, UpdateRateCardInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateRateCardInput) => api.put<CustomerRateCard>(`/api/v1/rate-cards/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rateCardKeys.all });
    },
  });
}

export function useDeleteRateCard(): ReturnType<typeof useMutation<void, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/v1/rate-cards/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rateCardKeys.all });
    },
  });
}

export function useCreateRateCardEntry(cardId: string): ReturnType<typeof useMutation<RateCardEntry, Error, CreateRateCardEntryInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRateCardEntryInput) => api.post<RateCardEntry>(`/api/v1/rate-cards/${cardId}/entries`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rateCardKeys.detail(cardId) });
    },
  });
}

export function useDeleteRateCardEntry(cardId: string): ReturnType<typeof useMutation<void, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => api.delete<void>(`/api/v1/rate-cards/${cardId}/entries/${entryId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rateCardKeys.detail(cardId) });
    },
  });
}
