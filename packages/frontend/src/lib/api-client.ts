/**
 * Typed fetch wrapper for Nexum API calls.
 * Automatically includes credentials (cookies) and JSON headers.
 */

interface ApiResponse<T> {
  success: true;
  data: T;
}

interface ApiErrorResponse {
  error: string;
  code: string;
  details?: Record<string, string[]>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details?: Record<string, string[]>,
  ) {
    super(`API Error: ${code}`);
    this.name = "ApiError";
  }
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({
      error: "Unknown error",
      code: "UNKNOWN",
    }))) as ApiErrorResponse;
    throw new ApiError(response.status, body.code, body.details);
  }

  const body = (await response.json()) as ApiResponse<T>;
  return body.data;
}

export const api = {
  get<T>(url: string): Promise<T> {
    return request<T>(url);
  },

  post<T>(url: string, data: unknown): Promise<T> {
    return request<T>(url, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  put<T>(url: string, data: unknown): Promise<T> {
    return request<T>(url, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete<T>(url: string): Promise<T> {
    return request<T>(url, { method: "DELETE" });
  },
};
