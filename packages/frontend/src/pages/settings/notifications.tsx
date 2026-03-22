import { useState, useEffect } from "react";
import { Bell, Mail, MessageSquare, Smartphone } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import { Button } from "@frontend/components/ui/button.js";
import { Label } from "@frontend/components/ui/label.js";
import { Checkbox } from "@frontend/components/ui/checkbox.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@frontend/components/ui/card.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { toast } from "sonner";

// ── Types ──

interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  categoryOverrides: CategoryOverride[];
}

interface CategoryOverride {
  category: string;
  label: string;
  push: boolean;
  email: boolean;
  sms: boolean;
  inApp: boolean;
}

const DEFAULT_CATEGORIES: CategoryOverride[] = [
  { category: "job_updates", label: "Job Updates", push: true, email: true, sms: false, inApp: true },
  { category: "daysheet_submitted", label: "Daysheet Submitted", push: true, email: false, sms: false, inApp: true },
  { category: "invoice_approved", label: "Invoice Approved", push: false, email: true, sms: false, inApp: true },
  { category: "payment_received", label: "Payment Received", push: false, email: true, sms: false, inApp: true },
  { category: "document_expiring", label: "Document Expiring", push: true, email: true, sms: true, inApp: true },
  { category: "compliance_alert", label: "Compliance Alert", push: true, email: true, sms: true, inApp: true },
  { category: "scheduling_change", label: "Scheduling Change", push: true, email: false, sms: true, inApp: true },
  { category: "system_notification", label: "System Notifications", push: false, email: true, sms: false, inApp: true },
];

// ── API Hooks ──

const notificationKeys = {
  all: ["notification-preferences"] as const,
};

function useNotificationPreferences(): ReturnType<typeof useQuery<NotificationPreferences>> {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => api.get<NotificationPreferences>("/api/v1/notification-preferences"),
  });
}

function useUpdateNotificationPreferences(): ReturnType<
  typeof useMutation<NotificationPreferences, Error, NotificationPreferences>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: NotificationPreferences) =>
      api.put<NotificationPreferences>("/api/v1/notification-preferences", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

// ── Helpers ──

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, "0");
  return { value: `${h}:00`, label: `${h}:00` };
});

// ── Component ──

export function NotificationSettingsPage(): React.JSX.Element {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();

  const [form, setForm] = useState<NotificationPreferences>({
    pushEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
    inAppEnabled: true,
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    categoryOverrides: DEFAULT_CATEGORIES,
  });

  useEffect(() => {
    if (preferences) {
      setForm({
        ...preferences,
        categoryOverrides:
          preferences.categoryOverrides.length > 0
            ? preferences.categoryOverrides
            : DEFAULT_CATEGORIES,
      });
    }
  }, [preferences]);

  function toggleGlobal(field: keyof Pick<NotificationPreferences, "pushEnabled" | "emailEnabled" | "smsEnabled" | "inAppEnabled" | "quietHoursEnabled">, value: boolean): void {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateCategoryOverride(category: string, channel: keyof Pick<CategoryOverride, "push" | "email" | "sms" | "inApp">, value: boolean): void {
    setForm((prev) => ({
      ...prev,
      categoryOverrides: prev.categoryOverrides.map((co) =>
        co.category === category ? { ...co, [channel]: value } : co,
      ),
    }));
  }

  async function handleSave(): Promise<void> {
    try {
      await updatePrefs.mutateAsync(form);
      toast.success("Notification preferences saved");
    } catch {
      toast.error("Failed to save notification preferences");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="text-sm text-muted-foreground">Configure notification preferences</p>
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Configure how and when you receive notifications
        </p>
      </div>

      {/* Global Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Global Channels</CardTitle>
          <CardDescription>Enable or disable notification channels</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="pushEnabled"
              checked={form.pushEnabled}
              onCheckedChange={(checked) => toggleGlobal("pushEnabled", checked === true)}
            />
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="pushEnabled">Push Notifications</Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="emailEnabled"
              checked={form.emailEnabled}
              onCheckedChange={(checked) => toggleGlobal("emailEnabled", checked === true)}
            />
            <Mail className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="emailEnabled">Email Notifications</Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="smsEnabled"
              checked={form.smsEnabled}
              onCheckedChange={(checked) => toggleGlobal("smsEnabled", checked === true)}
            />
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="smsEnabled">SMS Notifications</Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="inAppEnabled"
              checked={form.inAppEnabled}
              onCheckedChange={(checked) => toggleGlobal("inAppEnabled", checked === true)}
            />
            <Bell className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="inAppEnabled">In-App Notifications</Label>
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quiet Hours</CardTitle>
          <CardDescription>Pause non-critical notifications during set hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="quietHoursEnabled"
              checked={form.quietHoursEnabled}
              onCheckedChange={(checked) => toggleGlobal("quietHoursEnabled", checked === true)}
            />
            <Label htmlFor="quietHoursEnabled">Enable quiet hours</Label>
          </div>
          {form.quietHoursEnabled && (
            <div className="flex items-center gap-4 pl-8">
              <div className="space-y-1">
                <Label>From</Label>
                <Select
                  value={form.quietHoursStart}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, quietHoursStart: val }))}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h.value} value={h.value}>
                        {h.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Select
                  value={form.quietHoursEnd}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, quietHoursEnd: val }))}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h.value} value={h.value}>
                        {h.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-Category Overrides */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Category Preferences</CardTitle>
          <CardDescription>
            Override notification channels per category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left text-sm font-medium">Category</th>
                  <th className="p-3 text-center text-sm font-medium">
                    <Smartphone className="mx-auto h-4 w-4" />
                  </th>
                  <th className="p-3 text-center text-sm font-medium">
                    <Mail className="mx-auto h-4 w-4" />
                  </th>
                  <th className="p-3 text-center text-sm font-medium">
                    <MessageSquare className="mx-auto h-4 w-4" />
                  </th>
                  <th className="p-3 text-center text-sm font-medium">
                    <Bell className="mx-auto h-4 w-4" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {form.categoryOverrides.map((co) => (
                  <tr key={co.category} className="border-b last:border-0">
                    <td className="p-3 text-sm">{co.label}</td>
                    <td className="p-3 text-center">
                      <Checkbox
                        checked={co.push}
                        disabled={!form.pushEnabled}
                        onCheckedChange={(checked) =>
                          updateCategoryOverride(co.category, "push", checked === true)
                        }
                      />
                    </td>
                    <td className="p-3 text-center">
                      <Checkbox
                        checked={co.email}
                        disabled={!form.emailEnabled}
                        onCheckedChange={(checked) =>
                          updateCategoryOverride(co.category, "email", checked === true)
                        }
                      />
                    </td>
                    <td className="p-3 text-center">
                      <Checkbox
                        checked={co.sms}
                        disabled={!form.smsEnabled}
                        onCheckedChange={(checked) =>
                          updateCategoryOverride(co.category, "sms", checked === true)
                        }
                      />
                    </td>
                    <td className="p-3 text-center">
                      <Checkbox
                        checked={co.inApp}
                        disabled={!form.inAppEnabled}
                        onCheckedChange={(checked) =>
                          updateCategoryOverride(co.category, "inApp", checked === true)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} disabled={updatePrefs.isPending}>
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
