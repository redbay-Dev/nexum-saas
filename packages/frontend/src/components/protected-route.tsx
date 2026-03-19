import { Navigate } from "react-router";
import { useSession } from "@frontend/lib/auth-client.js";
import { useAuthLoader } from "@frontend/hooks/use-auth-loader.js";
import { AuthContext } from "@frontend/hooks/use-auth.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";

export function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { data: session, isPending: sessionPending } = useSession();
  const authCtx = useAuthLoader();

  if (sessionPending || authCtx.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col gap-4 items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // User is authenticated but has no tenant yet — send to onboarding
  if (!authCtx.auth) {
    return <Navigate to="/onboard" replace />;
  }

  return (
    <AuthContext.Provider value={authCtx}>{children}</AuthContext.Provider>
  );
}
