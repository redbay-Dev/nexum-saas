import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import type { PaginatedResponse } from "@nexum/shared";

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  phone: string | null;
  email: string | null;
  homeAddress: string | null;
  position: string;
  employmentType: string;
  startDate: string;
  department: string | null;
  isDriver: boolean;
  contractorCompanyId: string | null;
  emergencyContacts: EmergencyContact[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Licence {
  id: string;
  employeeId: string;
  licenceClass: string;
  licenceNumber: string;
  stateOfIssue: string;
  expiryDate: string;
  conditions: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Medical {
  id: string;
  employeeId: string;
  certificateNumber: string | null;
  issuedDate: string;
  expiryDate: string;
  conditions: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeQualification {
  id: string;
  qualificationTypeId: string;
  qualificationTypeName: string;
  referenceNumber: string | null;
  stateOfIssue: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeDetail extends Employee {
  licences: Licence[];
  medicals: Medical[];
  qualifications: EmployeeQualification[];
  complianceStatus: "compliant" | "non_compliant" | "expiring_soon" | null;
}

export interface EmployeeListParams {
  search?: string;
  status?: "active" | "on_leave" | "suspended" | "terminated";
  isDriver?: boolean;
  contractorCompanyId?: string;
  limit?: number;
  cursor?: string;
}

interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  homeAddress?: string;
  position: string;
  employmentType: string;
  startDate: string;
  department?: string;
  isDriver?: boolean;
  contractorCompanyId?: string;
  emergencyContacts?: EmergencyContact[];
  status?: string;
}

interface CreateLicenceInput {
  licenceClass: string;
  licenceNumber: string;
  stateOfIssue: string;
  expiryDate: string;
  conditions?: string;
}

interface CreateMedicalInput {
  certificateNumber?: string;
  issuedDate: string;
  expiryDate: string;
  conditions?: string;
  notes?: string;
}

interface CreateQualificationInput {
  qualificationTypeId: string;
  referenceNumber?: string;
  stateOfIssue?: string;
  issuedDate?: string;
  expiryDate?: string;
  notes?: string;
}

const employeeKeys = {
  all: ["employees"] as const,
  lists: () => [...employeeKeys.all, "list"] as const,
  list: (params: EmployeeListParams) =>
    [...employeeKeys.lists(), params] as const,
  details: () => [...employeeKeys.all, "detail"] as const,
  detail: (id: string) => [...employeeKeys.details(), id] as const,
};

function buildQueryString(params: EmployeeListParams): string {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.status) searchParams.set("status", params.status);
  if (params.isDriver !== undefined)
    searchParams.set("isDriver", String(params.isDriver));
  if (params.contractorCompanyId)
    searchParams.set("contractorCompanyId", params.contractorCompanyId);
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.cursor) searchParams.set("cursor", params.cursor);
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

export function useEmployees(
  params: EmployeeListParams = {},
): ReturnType<typeof useQuery<PaginatedResponse<Employee>>> {
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: () =>
      api.get<PaginatedResponse<Employee>>(
        `/api/v1/employees${buildQueryString(params)}`,
      ),
  });
}

export function useEmployee(
  id: string,
): ReturnType<typeof useQuery<EmployeeDetail>> {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: () => api.get<EmployeeDetail>(`/api/v1/employees/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateEmployee(): ReturnType<
  typeof useMutation<Employee, Error, CreateEmployeeInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEmployeeInput) =>
      api.post<Employee>("/api/v1/employees", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
}

export function useUpdateEmployee(
  id: string,
): ReturnType<
  typeof useMutation<Employee, Error, Partial<CreateEmployeeInput>>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateEmployeeInput>) =>
      api.put<Employee>(`/api/v1/employees/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: employeeKeys.detail(id),
      });
    },
  });
}

export function useDeleteEmployee(): ReturnType<
  typeof useMutation<{ id: string }, Error, string>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/api/v1/employees/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
}

// ── Licences ──

export function useCreateLicence(
  employeeId: string,
): ReturnType<typeof useMutation<Licence, Error, CreateLicenceInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLicenceInput) =>
      api.post<Licence>(`/api/v1/employees/${employeeId}/licences`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: employeeKeys.detail(employeeId),
      });
    },
  });
}

export function useUpdateLicence(
  employeeId: string,
  licenceId: string,
): ReturnType<
  typeof useMutation<Licence, Error, Partial<CreateLicenceInput>>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateLicenceInput>) =>
      api.put<Licence>(
        `/api/v1/employees/${employeeId}/licences/${licenceId}`,
        data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: employeeKeys.detail(employeeId),
      });
    },
  });
}

export function useDeleteLicence(
  employeeId: string,
): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (licenceId: string) =>
      api.delete<{ id: string }>(
        `/api/v1/employees/${employeeId}/licences/${licenceId}`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: employeeKeys.detail(employeeId),
      });
    },
  });
}

// ── Medicals ──

export function useCreateMedical(
  employeeId: string,
): ReturnType<typeof useMutation<Medical, Error, CreateMedicalInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMedicalInput) =>
      api.post<Medical>(`/api/v1/employees/${employeeId}/medicals`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: employeeKeys.detail(employeeId),
      });
    },
  });
}

export function useDeleteMedical(
  employeeId: string,
): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (medicalId: string) =>
      api.delete<{ id: string }>(
        `/api/v1/employees/${employeeId}/medicals/${medicalId}`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: employeeKeys.detail(employeeId),
      });
    },
  });
}

// ── Qualifications ──

export function useCreateQualification(
  employeeId: string,
): ReturnType<
  typeof useMutation<
    EmployeeQualification,
    Error,
    CreateQualificationInput
  >
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateQualificationInput) =>
      api.post<EmployeeQualification>(
        `/api/v1/employees/${employeeId}/qualifications`,
        data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: employeeKeys.detail(employeeId),
      });
    },
  });
}

export function useDeleteQualification(
  employeeId: string,
): ReturnType<typeof useMutation<{ id: string }, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (qualificationId: string) =>
      api.delete<{ id: string }>(
        `/api/v1/employees/${employeeId}/qualifications/${qualificationId}`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: employeeKeys.detail(employeeId),
      });
    },
  });
}
