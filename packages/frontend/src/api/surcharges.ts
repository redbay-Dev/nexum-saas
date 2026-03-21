import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";

export interface Surcharge {
  id: string;
  name: string;
  type: string;
  value: string;
  appliesTo: string[];
  autoApply: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SurchargeWithHistory extends Surcharge {
  history: Array<{
    id: string;
    previousValue: string;
    newValue: string;
    effectiveDate: string;
    changedBy: string;
    createdAt: string;
  }>;
}

export interface CreateSurchargeInput {
  name: string;
  type: string;
  value: number;
  appliesTo: string[];
  autoApply?: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive?: boolean;
  notes?: string;
}

const surchargeKeys = {
  all: ["surcharges"] as const,
  detail: (id: string) => [...surchargeKeys.all, id] as const,
};

export function useSurcharges(): ReturnType<typeof useQuery<Surcharge[]>> {
  return useQuery({
    queryKey: surchargeKeys.all,
    queryFn: () => api.get<Surcharge[]>("/api/v1/surcharges"),
  });
}

export function useSurcharge(id: string): ReturnType<typeof useQuery<SurchargeWithHistory>> {
  return useQuery({
    queryKey: surchargeKeys.detail(id),
    queryFn: () => api.get<SurchargeWithHistory>(`/api/v1/surcharges/${id}`),
    enabled: !!id,
  });
}

export function useCreateSurcharge(): ReturnType<typeof useMutation<Surcharge, Error, CreateSurchargeInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSurchargeInput) => api.post<Surcharge>("/api/v1/surcharges", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: surchargeKeys.all });
    },
  });
}

export function useUpdateSurcharge(id: string): ReturnType<typeof useMutation<Surcharge, Error, Partial<CreateSurchargeInput>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateSurchargeInput>) => api.put<Surcharge>(`/api/v1/surcharges/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: surchargeKeys.all });
    },
  });
}

export function useDeleteSurcharge(): ReturnType<typeof useMutation<void, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/v1/surcharges/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: surchargeKeys.all });
    },
  });
}
