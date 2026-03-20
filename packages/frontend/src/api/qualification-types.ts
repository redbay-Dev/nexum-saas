import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import type { PaginatedResponse } from "@nexum/shared";

export interface QualificationType {
  id: string;
  name: string;
  description: string | null;
  hasExpiry: boolean;
  requiresEvidence: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateQualificationTypeInput {
  name: string;
  description?: string;
  hasExpiry?: boolean;
  requiresEvidence?: boolean;
}

const qualTypeKeys = {
  all: ["qualification-types"] as const,
  lists: () => [...qualTypeKeys.all, "list"] as const,
  list: (search?: string) => [...qualTypeKeys.lists(), { search }] as const,
};

export function useQualificationTypes(
  search?: string,
): ReturnType<typeof useQuery<PaginatedResponse<QualificationType>>> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return useQuery({
    queryKey: qualTypeKeys.list(search),
    queryFn: () =>
      api.get<PaginatedResponse<QualificationType>>(
        `/api/v1/qualification-types${qs}`,
      ),
  });
}

export function useCreateQualificationType(): ReturnType<
  typeof useMutation<
    QualificationType,
    Error,
    CreateQualificationTypeInput
  >
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateQualificationTypeInput) =>
      api.post<QualificationType>("/api/v1/qualification-types", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: qualTypeKeys.lists(),
      });
    },
  });
}
