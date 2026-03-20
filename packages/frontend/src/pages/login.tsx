import { useEffect } from "react";
import { useSearchParams } from "react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import { Button } from "@frontend/components/ui/button.js";
import { Truck } from "lucide-react";
import { redirectToLogin } from "@frontend/lib/auth-client.js";

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: "Login failed: missing authentication token",
  invalid_token: "Login failed: invalid authentication token",
};

/**
 * Login page.
 *
 * If there's no error, redirects to OpShield for SSO login.
 * If there's an error (e.g., invalid/missing token from callback), shows the error
 * with a button to retry.
 */
export function LoginPage(): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const errorParam = searchParams.get("error");
  const errorMessage = errorParam ? (ERROR_MESSAGES[errorParam] ?? null) : null;

  // Auto-redirect to OpShield if no error
  useEffect(() => {
    if (!errorMessage) {
      redirectToLogin();
    }
  }, [errorMessage]);

  // If no error, show a brief loading state while redirecting
  if (!errorMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary shadow-sm">
            <Truck className="size-6 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Show error with retry button
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary shadow-sm">
            <Truck className="size-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Nexum</h1>
          <p className="text-sm text-muted-foreground">
            Operations Management Platform
          </p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Sign In</CardTitle>
            <CardDescription>
              Authentication is managed by OpShield
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={redirectToLogin} className="w-full">
              Try Again
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
