import { useSearchParams } from "react-router";
import { AlertTriangle, Truck } from "lucide-react";
import { Button } from "@frontend/components/ui/button.js";
import { redirectToLogin } from "@frontend/lib/auth-client.js";

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: "Authentication token was not provided. Please try signing in again.",
  invalid_token: "Authentication token was invalid or expired. Please try signing in again.",
};

export function AuthErrorPage(): React.JSX.Element {
  const [params] = useSearchParams();
  const errorCode = params.get("error") ?? "unknown";
  const message = ERROR_MESSAGES[errorCode] ?? "An authentication error occurred. Please try again.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-md">
            <Truck className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Nexum</h1>
        </div>

        <div className="rounded-xl border bg-card p-8 shadow-md">
          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold">Authentication Error</h2>
            <p className="text-center text-sm text-muted-foreground">{message}</p>
          </div>

          <Button
            onClick={() => void redirectToLogin()}
            className="h-11 w-full text-sm font-medium"
          >
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
