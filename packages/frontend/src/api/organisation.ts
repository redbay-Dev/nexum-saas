import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";

// ── Types ──

export interface Organisation {
  id: string;
  companyName: string;
  tradingName: string | null;
  abn: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  registeredAddress: string | null;
  bankBsb: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  defaultPaymentTerms: number;
  timezone: string;
  quotePricingMode: string;
  staleRateThresholdDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateOrganisationInput {
  companyName?: string;
  tradingName?: string;
  abn?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  registeredAddress?: string;
  bankBsb?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  defaultPaymentTerms?: number;
  timezone?: string;
  quotePricingMode?: string;
  staleRateThresholdDays?: number;
}

// ── Query Keys ──

const organisationKeys = {
  all: ["organisation"] as const,
};

// ── Hooks ──

export function useOrganisation(): ReturnType<typeof useQuery<Organisation>> {
  return useQuery({
    queryKey: organisationKeys.all,
    queryFn: () => api.get<Organisation>("/api/v1/organisation"),
  });
}

export function useUpdateOrganisation(): ReturnType<
  typeof useMutation<Organisation, Error, UpdateOrganisationInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateOrganisationInput) =>
      api.put<Organisation>("/api/v1/organisation", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organisationKeys.all });
    },
  });
}
