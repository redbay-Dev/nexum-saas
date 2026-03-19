import { useState, useEffect, useCallback } from "react";
import type { AuthInfo, AuthContextValue } from "./use-auth.js";
import type { Permission } from "@nexum/shared";

/**
 * Fetches auth info from /api/v1/auth/me and provides the full auth context.
 * Returns auth info, pending state, permission check helper, and refresh function.
 */
export function useAuthLoader(): AuthContextValue {
  const [auth, setAuth] = useState<AuthInfo | null>(null);
  const [isPending, setIsPending] = useState(true);

  const load = useCallback(() => {
    setIsPending(true);
    fetch("/api/v1/auth/me", { credentials: "include" })
      .then(async (res) => {
        if (res.ok) {
          const body = (await res.json()) as { success: boolean; data: AuthInfo };
          setAuth(body.data);
        } else {
          setAuth(null);
        }
      })
      .catch(() => setAuth(null))
      .finally(() => setIsPending(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const can = useCallback(
    (permission: Permission): boolean => {
      if (!auth) return false;
      return auth.permissions.includes(permission);
    },
    [auth],
  );

  return { auth, isPending, can, refresh: load };
}
