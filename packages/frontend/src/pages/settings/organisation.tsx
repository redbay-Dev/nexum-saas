import { useState } from "react";
import { useOrganisation, useUpdateOrganisation } from "@frontend/api/organisation.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@frontend/components/ui/card.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@frontend/components/ui/select.js";
import { toast } from "sonner";
import { Skeleton } from "@frontend/components/ui/skeleton.js";

const AUSTRALIAN_TIMEZONES = [
  "Australia/Brisbane",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Hobart",
  "Australia/Darwin",
  "Australia/Lord_Howe",
];

export function OrganisationSettingsPage(): React.JSX.Element {
  const { data: org, isLoading } = useOrganisation();
  const updateOrg = useUpdateOrganisation();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, string | number>>({});

  function startEditing(): void {
    if (!org) return;
    setFormData({
      companyName: org.companyName,
      tradingName: org.tradingName ?? "",
      abn: org.abn,
      phone: org.phone ?? "",
      email: org.email ?? "",
      website: org.website ?? "",
      registeredAddress: org.registeredAddress ?? "",
      bankBsb: org.bankBsb ?? "",
      bankAccountNumber: org.bankAccountNumber ?? "",
      bankAccountName: org.bankAccountName ?? "",
      defaultPaymentTerms: org.defaultPaymentTerms,
      timezone: org.timezone,
      quotePricingMode: org.quotePricingMode ?? "lock_at_quote",
      staleRateThresholdDays: org.staleRateThresholdDays ?? 180,
    });
    setIsEditing(true);
  }

  function handleChange(field: string, value: string | number): void {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave(): void {
    updateOrg.mutate(formData, {
      onSuccess: () => {
        toast.success("Organisation updated");
        setIsEditing(false);
      },
      onError: () => {
        toast.error("Failed to update organisation");
      },
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!org) {
    return <p className="text-muted-foreground">Organisation not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Organisation</h2>
          <p className="text-muted-foreground">Manage your company profile and business settings.</p>
        </div>
        {!isEditing ? (
          <Button onClick={startEditing}>Edit</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateOrg.isPending}>
              {updateOrg.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
          <CardDescription>Your business identity and registration details.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Company Name</Label>
            {isEditing ? (
              <Input value={formData.companyName as string} onChange={(e) => handleChange("companyName", e.target.value)} />
            ) : (
              <p className="text-sm">{org.companyName}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Trading Name</Label>
            {isEditing ? (
              <Input value={formData.tradingName as string} onChange={(e) => handleChange("tradingName", e.target.value)} />
            ) : (
              <p className="text-sm text-muted-foreground">{org.tradingName || "—"}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>ABN</Label>
            {isEditing ? (
              <Input value={formData.abn as string} onChange={(e) => handleChange("abn", e.target.value)} maxLength={11} />
            ) : (
              <p className="text-sm font-mono">{org.abn}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            {isEditing ? (
              <Input value={formData.phone as string} onChange={(e) => handleChange("phone", e.target.value)} />
            ) : (
              <p className="text-sm">{org.phone || "—"}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            {isEditing ? (
              <Input type="email" value={formData.email as string} onChange={(e) => handleChange("email", e.target.value)} />
            ) : (
              <p className="text-sm">{org.email || "—"}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Website</Label>
            {isEditing ? (
              <Input value={formData.website as string} onChange={(e) => handleChange("website", e.target.value)} />
            ) : (
              <p className="text-sm">{org.website || "—"}</p>
            )}
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label>Registered Address</Label>
            {isEditing ? (
              <Input value={formData.registeredAddress as string} onChange={(e) => handleChange("registeredAddress", e.target.value)} />
            ) : (
              <p className="text-sm">{org.registeredAddress || "—"}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Banking Details</CardTitle>
          <CardDescription>Bank account for invoicing and remittance.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>BSB</Label>
            {isEditing ? (
              <Input value={formData.bankBsb as string} onChange={(e) => handleChange("bankBsb", e.target.value)} maxLength={6} placeholder="000000" />
            ) : (
              <p className="text-sm font-mono">{org.bankBsb ? `${org.bankBsb.slice(0, 3)}-${org.bankBsb.slice(3)}` : "—"}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Account Number</Label>
            {isEditing ? (
              <Input value={formData.bankAccountNumber as string} onChange={(e) => handleChange("bankAccountNumber", e.target.value)} />
            ) : (
              <p className="text-sm font-mono">{org.bankAccountNumber || "—"}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Account Name</Label>
            {isEditing ? (
              <Input value={formData.bankAccountName as string} onChange={(e) => handleChange("bankAccountName", e.target.value)} />
            ) : (
              <p className="text-sm">{org.bankAccountName || "—"}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business Settings</CardTitle>
          <CardDescription>Payment terms and regional configuration.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Default Payment Terms (days)</Label>
            {isEditing ? (
              <Input
                type="number"
                min={0}
                max={365}
                value={formData.defaultPaymentTerms as number}
                onChange={(e) => handleChange("defaultPaymentTerms", parseInt(e.target.value, 10) || 0)}
              />
            ) : (
              <p className="text-sm">{org.defaultPaymentTerms} days</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            {isEditing ? (
              <Select value={formData.timezone as string} onValueChange={(v) => handleChange("timezone", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUSTRALIAN_TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz.replace("Australia/", "")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm">{org.timezone.replace("Australia/", "")}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing Configuration</CardTitle>
          <CardDescription>Quote pricing behaviour and rate review settings.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Quote Pricing Mode</Label>
            {isEditing ? (
              <Select value={formData.quotePricingMode as string} onValueChange={(v) => handleChange("quotePricingMode", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lock_at_quote">Lock at Quote</SelectItem>
                  <SelectItem value="update_on_acceptance">Update on Acceptance</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm">{org.quotePricingMode === "lock_at_quote" ? "Lock at Quote" : "Update on Acceptance"}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formData.quotePricingMode === "lock_at_quote" || (!isEditing && org.quotePricingMode === "lock_at_quote")
                ? "Rates are locked when the quote is created. The quoted price is the price."
                : "Rates are refreshed with current prices when the customer accepts the quote."}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Stale Rate Threshold (days)</Label>
            {isEditing ? (
              <Input
                type="number"
                min={1}
                max={730}
                value={formData.staleRateThresholdDays as number}
                onChange={(e) => handleChange("staleRateThresholdDays", parseInt(e.target.value, 10) || 180)}
              />
            ) : (
              <p className="text-sm">{org.staleRateThresholdDays} days</p>
            )}
            <p className="text-xs text-muted-foreground">
              Materials not updated within this period will be flagged for rate review.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
