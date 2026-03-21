import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";

export interface PricingTemplate {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateLine {
  id: string;
  templateId: string;
  lineType: string;
  category: string;
  description: string | null;
  rateType: string;
  unitRate: string | null;
  quantity: string | null;
  partyId: string | null;
  sortOrder: number;
}

export interface PricingTemplateWithLines extends PricingTemplate {
  lines: TemplateLine[];
}

export interface CreatePricingTemplateInput {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateTemplateLineInput {
  lineType: string;
  category: string;
  description?: string;
  rateType: string;
  unitRate?: number;
  quantity?: number;
  partyId?: string;
  sortOrder?: number;
}

export interface ApplyTemplateResult {
  templateName: string;
  linesCreated: number;
  lines: unknown[];
}

const templateKeys = {
  all: ["pricing-templates"] as const,
  detail: (id: string) => [...templateKeys.all, id] as const,
};

export function usePricingTemplates(): ReturnType<typeof useQuery<PricingTemplate[]>> {
  return useQuery({
    queryKey: templateKeys.all,
    queryFn: () => api.get<PricingTemplate[]>("/api/v1/pricing-templates"),
  });
}

export function usePricingTemplate(id: string): ReturnType<typeof useQuery<PricingTemplateWithLines>> {
  return useQuery({
    queryKey: templateKeys.detail(id),
    queryFn: () => api.get<PricingTemplateWithLines>(`/api/v1/pricing-templates/${id}`),
    enabled: !!id,
  });
}

export function useCreatePricingTemplate(): ReturnType<typeof useMutation<PricingTemplate, Error, CreatePricingTemplateInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePricingTemplateInput) => api.post<PricingTemplate>("/api/v1/pricing-templates", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}

export function useDeletePricingTemplate(): ReturnType<typeof useMutation<void, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/v1/pricing-templates/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}

export function useCreateTemplateLine(templateId: string): ReturnType<typeof useMutation<TemplateLine, Error, CreateTemplateLineInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTemplateLineInput) => api.post<TemplateLine>(`/api/v1/pricing-templates/${templateId}/lines`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: templateKeys.detail(templateId) });
    },
  });
}

export function useDeleteTemplateLine(templateId: string): ReturnType<typeof useMutation<void, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) => api.delete<void>(`/api/v1/pricing-templates/${templateId}/lines/${lineId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: templateKeys.detail(templateId) });
    },
  });
}

export function useApplyPricingTemplate(templateId: string): ReturnType<typeof useMutation<ApplyTemplateResult, Error, { jobId: string }>> {
  return useMutation({
    mutationFn: (data: { jobId: string }) => api.post<ApplyTemplateResult>(`/api/v1/pricing-templates/${templateId}/apply`, data),
  });
}
