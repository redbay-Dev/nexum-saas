import { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Link2,
  Link2Off,
} from "lucide-react";
import {
  useXeroStatus,
  useXeroAccounts,
  useXeroMappings,
  useXeroContacts,
  useXeroSyncLog,
  useXeroReconciliation,
  useXeroConnect,
  useXeroDisconnect,
  useXeroSettings,
  useXeroSyncContacts,
  useXeroSyncAccounts,
} from "@frontend/api/xero.js";
import type { XeroSettingsInput } from "@frontend/api/xero.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Checkbox } from "@frontend/components/ui/checkbox.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@frontend/components/ui/card.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/components/ui/table.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { toast } from "sonner";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SYNC_STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  synced: "default",
  pending: "secondary",
  error: "destructive",
  unsynced: "outline",
  success: "default",
  failed: "destructive",
  running: "secondary",
  matched: "default",
  mismatch: "destructive",
};

export function XeroSettingsPage(): React.JSX.Element {
  const { data: status, isLoading: statusLoading } = useXeroStatus();
  const { data: accountsData, isLoading: accountsLoading } = useXeroAccounts();
  const { data: mappingsData, isLoading: mappingsLoading } = useXeroMappings();
  const { data: contactsData, isLoading: contactsLoading } = useXeroContacts();
  const { data: syncLogData, isLoading: logLoading } = useXeroSyncLog();
  const { data: reconciliationData } = useXeroReconciliation();

  const connectXero = useXeroConnect();
  const disconnectXero = useXeroDisconnect();
  const updateSettings = useXeroSettings();
  const syncContacts = useXeroSyncContacts();
  const syncAccounts = useXeroSyncAccounts();

  const accounts = accountsData?.data ?? [];
  const mappings = mappingsData?.data ?? [];
  const contacts = contactsData?.data ?? [];
  const syncLog = syncLogData?.data ?? [];
  const reconciliation = reconciliationData?.data ?? [];

  const [syncForm, setSyncForm] = useState<XeroSettingsInput>({
    autoCreateContacts: false,
    autoSyncPayments: false,
    pollIntervalMinutes: 15,
    syncInvoices: true,
    syncBills: true,
    syncContacts: true,
  });

  useEffect(() => {
    if (status) {
      // Settings are derived from status in this API; form defaults are fine
    }
  }, [status]);

  async function handleConnect(): Promise<void> {
    try {
      const result = await connectXero.mutateAsync();
      window.location.href = result.authorizeUrl;
    } catch {
      toast.error("Failed to initiate Xero connection");
    }
  }

  async function handleDisconnect(): Promise<void> {
    try {
      await disconnectXero.mutateAsync();
      toast.success("Xero disconnected");
    } catch {
      toast.error("Failed to disconnect Xero");
    }
  }

  async function handleSaveSettings(): Promise<void> {
    try {
      await updateSettings.mutateAsync(syncForm);
      toast.success("Sync settings saved");
    } catch {
      toast.error("Failed to save settings");
    }
  }

  async function handleSyncContacts(): Promise<void> {
    try {
      const result = await syncContacts.mutateAsync();
      toast.success(`Synced ${result.synced} contacts`);
    } catch {
      toast.error("Contact sync failed");
    }
  }

  async function handleSyncAccounts(): Promise<void> {
    try {
      const result = await syncAccounts.mutateAsync();
      toast.success(`Synced ${result.synced} accounts`);
    } catch {
      toast.error("Account sync failed");
    }
  }

  // Reconciliation summary counts
  const reconSynced = reconciliation.filter((r) => r.status === "matched").length;
  const reconUnsynced = reconciliation.filter((r) => r.status !== "matched").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Xero Integration</h2>
        <p className="text-sm text-muted-foreground">
          Connect to Xero for accounting sync
        </p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection Status</CardTitle>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : status?.connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Connected to {status.organisationName}</p>
                  <p className="text-xs text-muted-foreground">
                    Connected {formatDate(status.connectedAt)}
                    {status.lastSyncAt && ` | Last sync ${formatDate(status.lastSyncAt)}`}
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void handleDisconnect()}
                disabled={disconnectXero.isPending}
              >
                <Link2Off className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <p className="text-muted-foreground">Not connected to Xero</p>
              </div>
              <Button
                onClick={() => void handleConnect()}
                disabled={connectXero.isPending}
              >
                <Link2 className="mr-2 h-4 w-4" />
                Connect to Xero
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync Settings</CardTitle>
          <CardDescription>Configure automatic synchronisation behaviour</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="autoCreateContacts"
              checked={syncForm.autoCreateContacts ?? false}
              onCheckedChange={(checked) =>
                setSyncForm((prev) => ({ ...prev, autoCreateContacts: checked === true }))
              }
            />
            <Label htmlFor="autoCreateContacts">
              Auto-create contacts in Xero when new companies are added
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="autoSyncPayments"
              checked={syncForm.autoSyncPayments ?? false}
              onCheckedChange={(checked) =>
                setSyncForm((prev) => ({ ...prev, autoSyncPayments: checked === true }))
              }
            />
            <Label htmlFor="autoSyncPayments">
              Automatically sync payments from Xero
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="syncInvoices"
              checked={syncForm.syncInvoices ?? true}
              onCheckedChange={(checked) =>
                setSyncForm((prev) => ({ ...prev, syncInvoices: checked === true }))
              }
            />
            <Label htmlFor="syncInvoices">Sync invoices to Xero</Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="syncBills"
              checked={syncForm.syncBills ?? true}
              onCheckedChange={(checked) =>
                setSyncForm((prev) => ({ ...prev, syncBills: checked === true }))
              }
            />
            <Label htmlFor="syncBills">Sync bills (RCTIs) to Xero</Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="syncContactsToggle"
              checked={syncForm.syncContacts ?? true}
              onCheckedChange={(checked) =>
                setSyncForm((prev) => ({ ...prev, syncContacts: checked === true }))
              }
            />
            <Label htmlFor="syncContactsToggle">Sync contacts to Xero</Label>
          </div>
          <div className="flex items-center gap-3 max-w-xs">
            <Label htmlFor="pollInterval" className="shrink-0">Poll interval (minutes)</Label>
            <Input
              id="pollInterval"
              type="number"
              value={String(syncForm.pollIntervalMinutes ?? 15)}
              onChange={(e) =>
                setSyncForm((prev) => ({ ...prev, pollIntervalMinutes: parseInt(e.target.value) || 15 }))
              }
              min="5"
              max="1440"
              className="w-24"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => void handleSaveSettings()}
              disabled={updateSettings.isPending}
              size="sm"
            >
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sync Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync Actions</CardTitle>
          <CardDescription>Manually trigger synchronisation operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => void handleSyncAccounts()}
              disabled={syncAccounts.isPending}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Chart of Accounts
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleSyncContacts()}
              disabled={syncContacts.isPending}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Contacts
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reconciliation Summary */}
      {reconciliation.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reconciliation Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-semibold">{reconSynced}</p>
                <p className="text-xs text-muted-foreground">Matched</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-semibold">{reconUnsynced}</p>
                <p className="text-xs text-muted-foreground">Unmatched / Discrepancies</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Mappings (Xero Accounts synced) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Xero Accounts</CardTitle>
          <CardDescription>Chart of accounts synced from Xero</CardDescription>
        </CardHeader>
        <CardContent>
          {accountsLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : accounts.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No accounts synced. Sync your Chart of Accounts first.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tax Type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.slice(0, 20).map((account) => (
                  <TableRow key={account.accountId}>
                    <TableCell className="font-mono text-sm">{account.code}</TableCell>
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell className="capitalize">{account.type}</TableCell>
                    <TableCell>{account.taxType ?? "--"}</TableCell>
                    <TableCell>
                      <Badge variant={account.status === "ACTIVE" ? "default" : "secondary"}>
                        {account.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {accounts.length > 20 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Showing 20 of {accounts.length} accounts
            </p>
          )}
        </CardContent>
      </Card>

      {/* Field Mappings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Field Mappings</CardTitle>
          <CardDescription>Map Nexum fields to Xero fields</CardDescription>
        </CardHeader>
        <CardContent>
          {mappingsLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : mappings.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No field mappings configured
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nexum Entity</TableHead>
                  <TableHead>Nexum Field</TableHead>
                  <TableHead>Xero Entity</TableHead>
                  <TableHead>Xero Field</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell className="capitalize">{mapping.nexumEntity}</TableCell>
                    <TableCell className="font-mono text-xs">{mapping.nexumField}</TableCell>
                    <TableCell className="capitalize">{mapping.xeroEntity}</TableCell>
                    <TableCell className="font-mono text-xs">{mapping.xeroField}</TableCell>
                    <TableCell>{mapping.defaultValue ?? "--"}</TableCell>
                    <TableCell>
                      <Badge variant={mapping.isActive ? "default" : "secondary"}>
                        {mapping.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Contact Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Links</CardTitle>
          <CardDescription>Companies linked to Xero contacts</CardDescription>
        </CardHeader>
        <CardContent>
          {contactsLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : contacts.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No contact links. Sync contacts to create links.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Xero Contact ID</TableHead>
                  <TableHead>Linked</TableHead>
                  <TableHead>Sync Status</TableHead>
                  <TableHead>Last Synced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.contactId}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>{contact.emailAddress ?? "--"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {contact.contactId}
                    </TableCell>
                    <TableCell>
                      <Badge variant={contact.isLinked ? "default" : "outline"}>
                        {contact.isLinked ? "Linked" : "Unlinked"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={SYNC_STATUS_VARIANTS[contact.syncStatus] ?? "outline"} className="capitalize">
                        {contact.syncStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(contact.lastSyncedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Sync Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync Log</CardTitle>
          <CardDescription>Recent synchronisation operations</CardDescription>
        </CardHeader>
        <CardContent>
          {logLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : syncLog.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No sync operations recorded
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead className="text-right">Processed</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncLog.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="capitalize">{entry.syncType.replace(/_/g, " ")}</TableCell>
                    <TableCell className="capitalize">{entry.direction}</TableCell>
                    <TableCell className="capitalize">{entry.entityType}</TableCell>
                    <TableCell className="text-right">{entry.recordsProcessed}</TableCell>
                    <TableCell className="text-right">{entry.recordsFailed}</TableCell>
                    <TableCell>
                      <Badge variant={SYNC_STATUS_VARIANTS[entry.status] ?? "outline"} className="capitalize">
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(entry.startedAt)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-destructive">
                      {entry.errorMessage ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
