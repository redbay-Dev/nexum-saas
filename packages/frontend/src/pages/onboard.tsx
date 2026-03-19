import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Loader2, Truck, CheckCircle2 } from "lucide-react";
import { api } from "@frontend/lib/api-client.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select.js";

const PLAN_FEATURES: Record<string, string[]> = {
  starter: ["Jobs & scheduling", "Business entities", "Dashboard"],
  professional: ["Everything in Starter", "Invoicing & RCTI", "Docket processing", "SMS notifications", "Reporting"],
  enterprise: ["Everything in Professional", "Xero integration", "AI automation", "Compliance module", "API access"],
};

export function OnboardPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [plan, setPlan] = useState("professional");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const features = PLAN_FEATURES[plan] ?? [];

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post("/api/v1/onboard", {
        name: companyName,
        plan,
        enabledModules: ["invoicing", "rcti", "docket_processing", "materials", "reporting"],
      });
      void navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-[480px]">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-md">
            <Truck className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Set up your workspace</h1>
          <p className="text-sm text-muted-foreground">
            Create your company workspace to get started
          </p>
        </div>

        <div className="rounded-xl border bg-card p-8 shadow-md">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">Company details</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tell us about your business</p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
            {error ? (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="companyName">Company name</Label>
              <Input
                id="companyName"
                placeholder="e.g. Acme Transport Pty Ltd"
                className="h-11"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger id="plan" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">You can change your plan at any time.</p>
            </div>

            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {plan} includes
              </p>
              <ul className="space-y-2">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <Button type="submit" className="h-11 w-full text-sm font-medium" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : null}
              Create Workspace
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
