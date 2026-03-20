import { Navigate } from "react-router";
import { useAuthLoader } from "@frontend/hooks/use-auth-loader.js";
import { AuthContext } from "@frontend/hooks/use-auth.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";

export function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const authCtx = useAuthLoader();

  if (authCtx.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!authCtx.auth) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AuthContext.Provider value={authCtx}>{children}</AuthContext.Provider>
  );
}
