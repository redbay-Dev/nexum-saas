import { createAuthClient } from "better-auth/react";

function makeClient() {
  return createAuthClient({
    baseURL: window.location.origin,
    basePath: "/api/auth",
  });
}

const authClient = makeClient();

export const useSession = authClient.useSession;
export const signIn = authClient.signIn;
export const signUp = authClient.signUp;
export const signOut = authClient.signOut;
