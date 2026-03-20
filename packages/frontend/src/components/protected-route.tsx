import { useAuthLoader } from "@frontend/hooks/use-auth-loader.js";
import { AuthContext } from "@frontend/hooks/use-auth.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { redirectToLogin } from "@frontend/lib/auth-client.js";
import { useEffect } from "react";

export function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const authCtx = useAuthLoader();

  useEffect(() => {
    // If loading is done and we have no auth, redirect to OpShield login
    if (!authCtx.isPending && !authCtx.auth) {
      void redirectToLogin();
    }
  }, [authCtx.isPending, authCtx.auth]);

  if (authCtx.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col gap-4 items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  // While redirecting to OpShield, show loading state
  if (!authCtx.auth) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col gap-4 items-center">
          <Skeleton className="h-8 w-48" />
          <p className="text-sm text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={authCtx}>{children}</AuthContext.Provider>
  );
}
