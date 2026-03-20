import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import type { PaginatedResponse } from "@nexum/shared";
import type { Contact } from "@frontend/api/contacts.js";

export interface Address {
  id: string;
  streetAddress: string;
  suburb: string;
  state: string;
  postcode: string;
  latitude: string | null;
  longitude: string | null;
  regionId: string | null;
  types: string[];
  operatingHours: string | null;
  accessConditions: string | null;
  siteNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EntryPoint {
  id: string;
  addressId: string;
  name: string;
  description: string | null;
  latitude: string | null;
  longitude: string | null;
  vehicleRestrictions: string | null;
  weightLimit: string | null;
  operatingHours: string | null;
  driverInstructions: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface LinkedCompany {
  id: string;
  name: string;
  tradingName: string | null;
  isCustomer: boolean;
  isContractor: boolean;
  isSupplier: boolean;
}

export interface AddressDetail extends Address {
  companies: LinkedCompany[];
  contacts: Contact[];
  entryPoints: EntryPoint[];
}

export interface AddressListParams {
  search?: string;
  companyId?: string;
  regionId?: string;
  state?: string;
  type?: string;
  limit?: number;
  cursor?: string;
}

interface CreateAddressInput {
  streetAddress: string;
  suburb: string;
  state: string;
  postcode: string;
  latitude?: number;
  longitude?: number;
  regionId?: string;
  types: string[];
  operatingHours?: string;
  accessConditions?: string;
  siteNotes?: string;
  companyId?: string;
}

interface CreateEntryPointInput {
  addressId: string;
  name: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  vehicleRestrictions?: string;
  weightLimit?: number;
  operatingHours?: string;
  driverInstructions?: string;
  status?: string;
}

export const addressKeys = {
  all: ["addresses"] as const,
  lists: () => [...addressKeys.all, "list"] as const,
  list: (params: AddressListParams) => [...addressKeys.lists(), params] as const,
  details: () => [...addressKeys.all, "detail"] as const,
  detail: (id: string) => [...addressKeys.details(), id] as const,
};

const entryPointKeys = {
  all: ["entry-points"] as const,
};

function buildQueryString(params: AddressListParams): string {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.companyId) searchParams.set("companyId", params.companyId);
  if (params.regionId) searchParams.set("regionId", params.regionId);
  if (params.state) searchParams.set("state", params.state);
  if (params.type) searchParams.set("type", params.type);
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.cursor) searchParams.set("cursor", params.cursor);
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

export function useAddresses(params: AddressListParams = {}): ReturnType<typeof useQuery<PaginatedResponse<Address>>> {
  return useQuery({
    queryKey: addressKeys.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<Address>>(
        `/api/v1/addresses${buildQueryString(params)}`,
      ),
  });
}

export function useAddress(id: string): ReturnType<typeof useQuery<AddressDetail>> {
  return useQuery({
    queryKey: addressKeys.detail(id),
    queryFn: () => api.get<AddressDetail>(`/api/v1/addresses/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateAddress(): ReturnType<typeof useMutation<Address, Error, CreateAddressInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAddressInput) =>
      api.post<Address>("/api/v1/addresses", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: addressKeys.lists() });
    },
  });
}

export function useUpdateAddress(id: string): ReturnType<typeof useMutation<Address, Error, Partial<CreateAddressInput>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateAddressInput>) =>
      api.put<Address>(`/api/v1/addresses/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: addressKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: addressKeys.detail(id) });
    },
  });
}

export function useDeleteAddress(): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/api/v1/addresses/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: addressKeys.lists() });
    },
  });
}

export function useLinkCompanyToAddress(addressId: string): ReturnType<typeof useMutation<unknown, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (companyId: string) =>
      api.post(`/api/v1/addresses/${addressId}/companies`, { companyId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: addressKeys.detail(addressId) });
    },
  });
}

export function useUnlinkCompanyFromAddress(addressId: string): ReturnType<typeof useMutation<unknown, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (companyId: string) =>
      api.delete(`/api/v1/addresses/${addressId}/companies/${companyId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: addressKeys.detail(addressId) });
    },
  });
}

export function useCreateEntryPoint(): ReturnType<typeof useMutation<EntryPoint, Error, CreateEntryPointInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEntryPointInput) =>
      api.post<EntryPoint>("/api/v1/entry-points", data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: addressKeys.detail(variables.addressId),
      });
      void queryClient.invalidateQueries({ queryKey: entryPointKeys.all });
    },
  });
}

export function useUpdateEntryPoint(
  id: string,
  addressId: string,
): ReturnType<typeof useMutation<EntryPoint, Error, Partial<CreateEntryPointInput>>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateEntryPointInput>) =>
      api.put<EntryPoint>(`/api/v1/entry-points/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: addressKeys.detail(addressId),
      });
      void queryClient.invalidateQueries({ queryKey: entryPointKeys.all });
    },
  });
}

export function useDeleteEntryPoint(addressId: string): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/api/v1/entry-points/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: addressKeys.detail(addressId),
      });
      void queryClient.invalidateQueries({ queryKey: entryPointKeys.all });
    },
  });
}
