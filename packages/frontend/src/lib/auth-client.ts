/**
 * Auth client for Nexum.
 *
 * Authentication is handled by OpShield.
 * Nexum only needs to:
 * 1. Check if the user has a valid session (cookie-based)
 * 2. Sign out (clear the session cookie)
 *
 * The session cookie is set by:
 *   GET /api/v1/auth/callback (redirect from OpShield after SSO login)
 */

import { useState, useEffect } from "react";

const OPSHIELD_URL =
  import.meta.env.VITE_OPSHIELD_URL ?? "http://localhost:5170";
const NEXUM_CALLBACK = `${window.location.origin}/api/v1/auth/callback`;

interface SessionData {
  userId: string;
  email: string;
  name: string;
  tenantId: string;
  role: string;
  isOwner: boolean;
}

interface SessionState {
  data: SessionData | null;
  isPending: boolean;
}

/**
 * React hook that checks for an active session via /api/v1/auth/me.
 * Returns session data if authenticated, null otherwise.
 */
export function useSession(): SessionState {
  const [data, setData] = useState<SessionData | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    fetch("/api/v1/auth/me", { credentials: "include" })
      .then(async (res) => {
        if (res.ok) {
          const body = (await res.json()) as { data: SessionData };
          setData(body.data);
        } else {
          setData(null);
        }
      })
      .catch(() => setData(null))
      .finally(() => setIsPending(false));
  }, []);

  return { data, isPending };
}

/**
 * Redirect to OpShield login page.
 */
export function redirectToLogin(): void {
  const loginUrl = `${OPSHIELD_URL}/auth/login?redirect=${encodeURIComponent(NEXUM_CALLBACK)}`;
  window.location.href = loginUrl;
}

/**
 * Redirect to OpShield signup page.
 */
export function redirectToSignup(): void {
  const signupUrl = `${OPSHIELD_URL}/auth/sign-up?redirect=${encodeURIComponent(NEXUM_CALLBACK)}`;
  window.location.href = signupUrl;
}

/**
 * Sign out — clear the local session cookie via backend, then redirect to OpShield.
 */
export async function signOut(): Promise<void> {
  await fetch("/api/v1/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  redirectToLogin();
}
