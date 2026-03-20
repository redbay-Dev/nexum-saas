import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import type { PaginatedResponse } from "@nexum/shared";

export interface EquipmentFitted {
  scales: boolean;
  mudLocks: boolean;
  fireExtinguisher: boolean;
  firstAid: boolean;
  uhfRadio: boolean;
  gpsTracking: boolean;
  isolationSwitch: boolean;
}

export interface Asset {
  id: string;
  assetNumber: string | null;
  categoryId: string;
  subcategoryId: string | null;
  ownership: string;
  contractorCompanyId: string | null;
  status: string;
  registrationNumber: string | null;
  registrationState: string | null;
  registrationExpiry: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  tareWeight: string | null;
  gvm: string | null;
  gcm: string | null;
  vehicleConfiguration: string | null;
  massScheme: string | null;
  bodyMaterial: string | null;
  sideHeight: string | null;
  bodyType: string | null;
  equipmentFitted: EquipmentFitted | null;
  capacity: string | null;
  capacityUnit: string | null;
  engineHours: string | null;
  engineHoursDate: string | null;
  odometer: string | null;
  odometerDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  categoryName: string | null;
  categoryType: string | null;
  subcategoryName: string | null;
  contractorName: string | null;
}

interface CategoryToggles {
  enableSpecifications: boolean;
  enableWeightSpecs: boolean;
  enableMassScheme: boolean;
  enableEngineHours: boolean;
  enableCapacityFields: boolean;
  enableRegistration: boolean;
}

interface DefaultPairingInfo {
  id: string;
  trailerId?: string;
  trailerAssetNumber?: string | null;
  trailerRegistration?: string | null;
  trailerMake?: string | null;
  trailerModel?: string | null;
  truckId?: string;
  truckAssetNumber?: string | null;
  truckRegistration?: string | null;
  truckMake?: string | null;
  truckModel?: string | null;
  notes: string | null;
}

export interface AssetDetail extends Asset {
  categoryToggles: CategoryToggles;
  defaultPairings: {
    asTruck: DefaultPairingInfo[];
    asTrailer: DefaultPairingInfo[];
  };
}

export interface AssetListParams {
  search?: string;
  categoryId?: string;
  status?: string;
  ownership?: "tenant" | "contractor";
  contractorCompanyId?: string;
  limit?: number;
  cursor?: string;
}

interface CreateAssetInput {
  assetNumber?: string;
  categoryId: string;
  subcategoryId?: string;
  ownership?: string;
  contractorCompanyId?: string;
  status?: string;
  registrationNumber?: string;
  registrationState?: string;
  registrationExpiry?: string;
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  tareWeight?: number;
  gvm?: number;
  gcm?: number;
  vehicleConfiguration?: string;
  massScheme?: string;
  bodyMaterial?: string;
  sideHeight?: number;
  bodyType?: string;
  equipmentFitted?: EquipmentFitted;
  capacity?: number;
  capacityUnit?: string;
  engineHours?: number;
  engineHoursDate?: string;
  odometer?: number;
  odometerDate?: string;
  notes?: string;
}

const assetKeys = {
  all: ["assets"] as const,
  lists: () => [...assetKeys.all, "list"] as const,
  list: (params: AssetListParams) => [...assetKeys.lists(), params] as const,
  details: () => [...assetKeys.all, "detail"] as const,
  detail: (id: string) => [...assetKeys.details(), id] as const,
};

function buildQueryString(params: AssetListParams): string {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.categoryId) searchParams.set("categoryId", params.categoryId);
  if (params.status) searchParams.set("status", params.status);
  if (params.ownership) searchParams.set("ownership", params.ownership);
  if (params.contractorCompanyId)
    searchParams.set("contractorCompanyId", params.contractorCompanyId);
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.cursor) searchParams.set("cursor", params.cursor);
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

export function useAssets(
  params: AssetListParams = {},
): ReturnType<typeof useQuery<PaginatedResponse<Asset>>> {
  return useQuery({
    queryKey: assetKeys.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<Asset>>(
        `/api/v1/assets${buildQueryString(params)}`,
      ),
  });
}

export function useAsset(
  id: string,
): ReturnType<typeof useQuery<AssetDetail>> {
  return useQuery({
    queryKey: assetKeys.detail(id),
    queryFn: () => api.get<AssetDetail>(`/api/v1/assets/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateAsset(): ReturnType<
  typeof useMutation<Asset, Error, CreateAssetInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAssetInput) =>
      api.post<Asset>("/api/v1/assets", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assetKeys.lists() });
    },
  });
}

export function useUpdateAsset(
  id: string,
): ReturnType<
  typeof useMutation<Asset, Error, Partial<CreateAssetInput>>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateAssetInput>) =>
      api.put<Asset>(`/api/v1/assets/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assetKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: assetKeys.detail(id) });
    },
  });
}

export function useUpdateAssetStatus(
  id: string,
): ReturnType<
  typeof useMutation<Asset, Error, { status: string; reason?: string }>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { status: string; reason?: string }) =>
      api.put<Asset>(`/api/v1/assets/${id}/status`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assetKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: assetKeys.detail(id) });
    },
  });
}

export function useDeleteAsset(): ReturnType<
  typeof useMutation<{ id: string }, Error, string>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/api/v1/assets/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assetKeys.lists() });
    },
  });
}

// ── Default Pairings ──

export function useCreatePairing(
  truckId: string,
): ReturnType<
  typeof useMutation<
    { id: string; truckId: string; trailerId: string },
    Error,
    { trailerId: string; notes?: string }
  >
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { trailerId: string; notes?: string }) =>
      api.post<{ id: string; truckId: string; trailerId: string }>(
        `/api/v1/assets/${truckId}/pairings`,
        data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: assetKeys.detail(truckId),
      });
    },
  });
}

export function useDeletePairing(
  assetId: string,
): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pairingId: string) =>
      api.delete<{ id: string }>(
        `/api/v1/assets/${assetId}/pairings/${pairingId}`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: assetKeys.detail(assetId),
      });
    },
  });
}
