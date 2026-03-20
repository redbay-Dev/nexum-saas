/**
 * Auth client for OpShield-delegated authentication.
 *
 * Nexum does NOT run its own auth — it delegates to OpShield.
 * This module provides helpers to check session status and redirect
 * to OpShield for login/signup/logout.
 */

interface LoginUrls {
  loginUrl: string;
  signupUrl: string;
}

let cachedUrls: LoginUrls | null = null;

/**
 * Fetch the OpShield login/signup URLs from the backend.
 * Cached after first call.
 */
export async function getAuthUrls(): Promise<LoginUrls> {
  if (cachedUrls) return cachedUrls;

  const res = await fetch("/api/v1/auth/login-url", {
    credentials: "include",
  });

  if (!res.ok) {
    // Fallback for dev when backend is not running
    return {
      loginUrl: "http://localhost:3000/login?product=nexum",
      signupUrl: "http://localhost:3000/signup?product=nexum",
    };
  }

  const body = (await res.json()) as { success: boolean; data: LoginUrls };
  cachedUrls = body.data;
  return cachedUrls;
}

/**
 * Redirect to OpShield login page.
 */
export async function redirectToLogin(): Promise<void> {
  const urls = await getAuthUrls();
  window.location.href = urls.loginUrl;
}

/**
 * Redirect to OpShield signup page.
 */
export async function redirectToSignup(): Promise<void> {
  const urls = await getAuthUrls();
  window.location.href = urls.signupUrl;
}

/**
 * Sign out — clear the local session cookie via backend, then redirect to OpShield.
 */
export async function signOut(): Promise<void> {
  await fetch("/api/v1/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  // Redirect to OpShield login after clearing local session
  const urls = await getAuthUrls();
  window.location.href = urls.loginUrl;
}
