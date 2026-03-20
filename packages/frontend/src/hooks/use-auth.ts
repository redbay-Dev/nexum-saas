import { createContext, useContext } from "react";
import type { Permission, UserRole } from "@nexum/shared";

export interface AuthInfo {
  userId: string;
  email: string;
  name: string;
  tenantId: string;
  role: UserRole;
  isOwner: boolean;
  permissions: readonly Permission[];
}

export interface AuthContextValue {
  auth: AuthInfo | null;
  isPending: boolean;
  can: (permission: Permission) => boolean;
  refresh: () => void;
}

export const AuthContext = createContext<AuthContextValue>({
  auth: null,
  isPending: true,
  can: () => false,
  refresh: () => undefined,
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
