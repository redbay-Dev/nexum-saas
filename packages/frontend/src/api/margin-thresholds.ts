import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";

export interface MarginThreshold {
  id: string;
  level: string;
  referenceId: string | null;
  minimumMarginPercent: string;
  warningMarginPercent: string;
  requiresApproval: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMarginThresholdInput {
  level: string;
  referenceId?: string;
  minimumMarginPercent: number;
  warningMarginPercent: number;
  requiresApproval?: boolean;
  isActive?: boolean;
}

const thresholdKeys = {
  all: ["margin-thresholds"] as const,
};

export function useMarginThresholds(): ReturnType<typeof useQuery<MarginThreshold[]>> {
  return useQuery({
    queryKey: thresholdKeys.all,
    queryFn: () => api.get<MarginThreshold[]>("/api/v1/margin-thresholds"),
  });
}

export function useCreateMarginThreshold(): ReturnType<typeof useMutation<MarginThreshold, Error, CreateMarginThresholdInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMarginThresholdInput) => api.post<MarginThreshold>("/api/v1/margin-thresholds", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: thresholdKeys.all });
    },
  });
}

export function useUpdateMarginThreshold(id: string): ReturnType<typeof useMutation<MarginThreshold, Error, Partial<CreateMarginThresholdInput>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateMarginThresholdInput>) => api.put<MarginThreshold>(`/api/v1/margin-thresholds/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: thresholdKeys.all });
    },
  });
}

export function useDeleteMarginThreshold(): ReturnType<typeof useMutation<void, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/v1/margin-thresholds/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: thresholdKeys.all });
    },
  });
}
