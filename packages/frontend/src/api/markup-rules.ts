import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";

export interface MarkupRule {
  id: string;
  name: string;
  type: string;
  markupPercentage: string | null;
  markupFixedAmount: string | null;
  materialCategoryId: string | null;
  supplierId: string | null;
  priority: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMarkupRuleInput {
  name: string;
  type: string;
  markupPercentage?: number;
  markupFixedAmount?: number;
  materialCategoryId?: string;
  supplierId?: string;
  priority?: number;
  isActive?: boolean;
  notes?: string;
}

export interface MarkupTestResult {
  matched: boolean;
  rule: MarkupRule | null;
  result: {
    costUnitRate: number;
    revenueUnitRate: number;
    costTotal: number;
    revenueTotal: number;
    marginPercent: number;
  } | null;
}

const markupRuleKeys = {
  all: ["markup-rules"] as const,
};

export function useMarkupRules(): ReturnType<typeof useQuery<MarkupRule[]>> {
  return useQuery({
    queryKey: markupRuleKeys.all,
    queryFn: () => api.get<MarkupRule[]>("/api/v1/markup-rules"),
  });
}

export function useCreateMarkupRule(): ReturnType<typeof useMutation<MarkupRule, Error, CreateMarkupRuleInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMarkupRuleInput) => api.post<MarkupRule>("/api/v1/markup-rules", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: markupRuleKeys.all });
    },
  });
}

export function useUpdateMarkupRule(id: string): ReturnType<typeof useMutation<MarkupRule, Error, Partial<CreateMarkupRuleInput>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateMarkupRuleInput>) => api.put<MarkupRule>(`/api/v1/markup-rules/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: markupRuleKeys.all });
    },
  });
}

export function useDeleteMarkupRule(): ReturnType<typeof useMutation<void, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/v1/markup-rules/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: markupRuleKeys.all });
    },
  });
}

export function useTestMarkupRule(): ReturnType<typeof useMutation<MarkupTestResult, Error, { materialCategoryId?: string; supplierId?: string; unitRate: number; quantity?: number }>> {
  return useMutation({
    mutationFn: (data) => api.post<MarkupTestResult>("/api/v1/markup-rules/test", data),
  });
}
