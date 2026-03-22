import { useState } from "react";
import { useParams } from "react-router";
import {
  useDaysheet,
  useTransitionDaysheet,
  useProcessDaysheet,
  useAddDaysheetLoad,
  useDeleteDaysheetLoad,
  useDetectOverages,
} from "@frontend/api/daysheets.js";
import { useOverageDecision } from "@frontend/api/daysheets.js";
import { useAuth } from "@frontend/hooks/use-auth.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Badge } from "@frontend/components/ui/badge.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/components/ui/table.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@frontend/components/ui/dialog.js";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Plus,
  Scale,
  Trash2,
  XCircle,
} from "lucide-react";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { toast } from "sonner";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  submitted: "outline",
  review: "secondary",
  reconciled: "default",
  processed: "secondary",
  rejected: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  review: "In Review",
  reconciled: "Reconciled",
  processed: "Processed",
  rejected: "Rejected",
};

const OVERAGE_SEVERITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  minor: "outline",
  significant: "secondary",
  critical: "destructive",
};

function formatNum(val: string | null, decimals: number = 2, suffix: string = ""): string {
  if (!val) return "—";
  const n = parseFloat(val);
  return isNaN(n) ? "—" : `${n.toFixed(decimals)}${suffix}`;
}

function formatCurrency(val: string | null): string {
  if (!val) return "—";
  const n = parseFloat(val);
  return isNaN(n) ? "—" : `$${n.toFixed(2)}`;
}

export function DaysheetDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { data: daysheet, isLoading } = useDaysheet(id ?? "");
  const transition = useTransitionDaysheet(id ?? "");
  const process = useProcessDaysheet(id ?? "");
  const detectOverages = useDetectOverages(id ?? "");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!daysheet) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Daysheet not found
      </div>
    );
  }

  const isProcessed = daysheet.status === "processed";
  const isRejected = daysheet.status === "rejected";
  const canProcess = !isProcessed && !isRejected && can("approve:dockets");
  const canEdit = !isProcessed && can("manage:dockets");

  async function handleTransition(status: string): Promise<void> {
    try {
      await transition.mutateAsync({ status });
      toast.success(`Status changed to ${STATUS_LABELS[status] ?? status}`);
    } catch {
      toast.error("Failed to change status");
    }
  }

  async function handleProcess(): Promise<void> {
    try {
      const result = await process.mutateAsync();
      toast.success(`Processed — ${result.chargeCount} charge(s) created`);
    } catch {
      toast.error("Failed to process daysheet");
    }
  }

  async function handleDetectOverages(): Promise<void> {
    try {
      const result = await detectOverages.mutateAsync();
      if (result.totalOverages === 0) {
        toast.success("No overages detected");
      } else {
        toast.warning(
          `${result.totalOverages} overage(s) detected — ${result.autoApproved} auto-approved, ${result.pendingApproval} pending`,
        );
      }
    } catch {
      toast.error("Failed to detect overages");
    }
  }

  // Revenue/cost totals from charges
  const totalRevenue = daysheet.charges
    .filter((c) => c.lineType === "revenue")
    .reduce((sum, c) => sum + parseFloat(c.total), 0);
  const totalCost = daysheet.charges
    .filter((c) => c.lineType === "cost")
    .reduce((sum, c) => sum + parseFloat(c.total), 0);
  const pendingOverageCount = daysheet.overages.filter((o) => o.approvalStatus === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">
              Daysheet — {daysheet.workDate}
            </h2>
            <Badge variant={STATUS_VARIANT[daysheet.status] ?? "outline"}>
              {STATUS_LABELS[daysheet.status] ?? daysheet.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {daysheet.jobNumber} — {daysheet.jobName}
            {daysheet.customerName ? ` | ${daysheet.customerName}` : ""}
          </p>
        </div>

        <div className="flex gap-2">
          {canEdit && daysheet.status === "submitted" && (
            <Button variant="outline" size="sm" onClick={() => void handleTransition("review")}>
              Start Review
            </Button>
          )}
          {canEdit && (daysheet.status === "review" || daysheet.status === "reconciled") && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleDetectOverages()}
                disabled={detectOverages.isPending}
              >
                <Scale className="mr-2 h-4 w-4" />
                Check Overages
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void handleTransition("rejected")}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </>
          )}
          {canProcess && daysheet.status !== "submitted" && (
            <Button
              onClick={() => void handleProcess()}
              disabled={process.isPending || pendingOverageCount > 0}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Process
              {pendingOverageCount > 0 ? ` (${pendingOverageCount} pending)` : ""}
            </Button>
          )}
          {isRejected && canEdit && (
            <Button variant="outline" size="sm" onClick={() => void handleTransition("submitted")}>
              Resubmit
            </Button>
          )}
        </div>
      </div>

      {/* Rejection banner */}
      {isRejected && daysheet.rejectionReason && (
        <div className="rounded-md border border-destructive bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-destructive font-medium text-sm">
            <XCircle className="h-4 w-4" />
            Rejected
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{daysheet.rejectionReason}</p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Driver</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">{daysheet.driverName ?? "Unassigned"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Asset</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">{daysheet.assetRegistration ?? daysheet.assetNumber ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Weight / Hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium font-mono">
              {daysheet.totalNetWeight
                ? formatNum(daysheet.totalNetWeight, 2, "t")
                : formatNum(daysheet.totalBillableHours, 1, "h")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Loads</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">{daysheet.loadCount ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Loads section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Loads</CardTitle>
            <CardDescription>{daysheet.loads.length} load(s) recorded</CardDescription>
          </div>
          {canEdit && <AddLoadDialog daysheetId={daysheet.id} nextLoadNumber={daysheet.loads.length + 1} />}
        </CardHeader>
        <CardContent>
          {daysheet.loads.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No loads recorded yet. Add loads to record material quantities.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Gross (t)</TableHead>
                  <TableHead className="text-right">Tare (t)</TableHead>
                  <TableHead className="text-right">Net (t)</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Docket #</TableHead>
                  {canEdit && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {daysheet.loads.map((load) => (
                  <LoadRow
                    key={load.id}
                    load={load}
                    daysheetId={daysheet.id}
                    canEdit={canEdit}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Overages section */}
      {daysheet.overages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Overages ({daysheet.overages.length})
            </CardTitle>
            <CardDescription>
              {pendingOverageCount} pending approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Limit</TableHead>
                  <TableHead className="text-right">Over by</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {daysheet.overages.map((overage) => (
                  <OverageRow key={overage.id} overage={overage} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dockets section */}
      {daysheet.dockets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Supporting Dockets ({daysheet.dockets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Issuer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Discrepancy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daysheet.dockets.map((docket) => (
                  <TableRow key={docket.id}>
                    <TableCell className="capitalize">{docket.docketType.replace(/_/g, " ")}</TableCell>
                    <TableCell>{docket.docketNumber ?? "—"}</TableCell>
                    <TableCell>{docket.issuerName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{docket.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {docket.hasDiscrepancy ? (
                        <Badge variant="destructive">Discrepancy</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Charges section (visible after processing) */}
      {daysheet.charges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Charges ({daysheet.charges.length})</CardTitle>
            <CardDescription>
              Revenue: ${totalRevenue.toFixed(2)} | Cost: ${totalCost.toFixed(2)} | Profit: ${(totalRevenue - totalCost).toFixed(2)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daysheet.charges.map((charge) => (
                  <TableRow key={charge.id}>
                    <TableCell>
                      <Badge variant={charge.lineType === "revenue" ? "default" : "outline"}>
                        {charge.lineType}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{charge.category.replace(/_/g, " ")}</TableCell>
                    <TableCell>{charge.description ?? "—"}</TableCell>
                    <TableCell>{charge.partyName ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">{formatNum(charge.quantity, 2)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(charge.unitRate)}</TableCell>
                    <TableCell className="text-right font-mono font-medium">{formatCurrency(charge.total)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{charge.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Time info */}
      {(daysheet.startTime || daysheet.endTime) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Start</span>
                <div className="font-medium">{daysheet.startTime ?? "—"}</div>
              </div>
              <div>
                <span className="text-muted-foreground">End</span>
                <div className="font-medium">{daysheet.endTime ?? "—"}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Hours Worked</span>
                <div className="font-medium">{formatNum(daysheet.hoursWorked, 1, "h")}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Overtime</span>
                <div className="font-medium">{formatNum(daysheet.overtimeHours, 1, "h")}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Billable</span>
                <div className="font-medium">{formatNum(daysheet.totalBillableHours, 1, "h")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {(daysheet.notes || daysheet.internalNotes) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {daysheet.notes && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Driver Notes</div>
                <p className="text-sm">{daysheet.notes}</p>
              </div>
            )}
            {daysheet.internalNotes && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Internal Notes</div>
                <p className="text-sm">{daysheet.internalNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <div className="text-xs text-muted-foreground space-y-1">
        <div>Created: {new Date(daysheet.createdAt).toLocaleString()}</div>
        {daysheet.processedAt && <div>Processed: {new Date(daysheet.processedAt).toLocaleString()} by {daysheet.processedBy}</div>}
      </div>
    </div>
  );
}

// ── Sub-components ──

function LoadRow({ load, daysheetId, canEdit }: {
  load: { id: string; loadNumber: number; materialName: string | null; grossWeight: string | null; tareWeight: string | null; netWeight: string | null; quantity: string | null; docketNumber: string | null };
  daysheetId: string;
  canEdit: boolean;
}): React.JSX.Element {
  const deleteLoad = useDeleteDaysheetLoad(daysheetId);

  return (
    <TableRow>
      <TableCell className="font-mono">{load.loadNumber}</TableCell>
      <TableCell>{load.materialName ?? "—"}</TableCell>
      <TableCell className="text-right font-mono">{formatNum(load.grossWeight)}</TableCell>
      <TableCell className="text-right font-mono">{formatNum(load.tareWeight)}</TableCell>
      <TableCell className="text-right font-mono font-medium">{formatNum(load.netWeight)}</TableCell>
      <TableCell className="text-right font-mono">{formatNum(load.quantity)}</TableCell>
      <TableCell>{load.docketNumber ?? "—"}</TableCell>
      {canEdit && (
        <TableCell>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => void deleteLoad.mutateAsync(load.id).then(() => toast.success("Load removed"))}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}

function OverageRow({ overage }: {
  overage: { id: string; overageType: string; severity: string; actualValue: string; limitValue: string; overageAmount: string; overagePercent: string; approvalStatus: string };
}): React.JSX.Element {
  const decision = useOverageDecision(overage.id);

  async function handleDecision(status: "approved" | "rejected"): Promise<void> {
    try {
      await decision.mutateAsync({ approvalStatus: status });
      toast.success(`Overage ${status}`);
    } catch {
      toast.error("Failed to update overage");
    }
  }

  return (
    <TableRow>
      <TableCell className="capitalize">{overage.overageType.replace(/_/g, " ")}</TableCell>
      <TableCell>
        <Badge variant={OVERAGE_SEVERITY_VARIANT[overage.severity] ?? "outline"}>
          {overage.severity}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-mono">{formatNum(overage.actualValue)}</TableCell>
      <TableCell className="text-right font-mono">{formatNum(overage.limitValue)}</TableCell>
      <TableCell className="text-right font-mono text-destructive">{formatNum(overage.overageAmount)}</TableCell>
      <TableCell className="text-right font-mono">{formatNum(overage.overagePercent, 1)}%</TableCell>
      <TableCell>
        <Badge variant={overage.approvalStatus === "pending" ? "secondary" : overage.approvalStatus === "approved" || overage.approvalStatus === "auto_approved" ? "default" : "destructive"}>
          {overage.approvalStatus === "auto_approved" ? "Auto" : overage.approvalStatus}
        </Badge>
      </TableCell>
      <TableCell>
        {overage.approvalStatus === "pending" && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => void handleDecision("approved")}>
              <CheckCircle2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => void handleDecision("rejected")}>
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function AddLoadDialog({ daysheetId, nextLoadNumber }: { daysheetId: string; nextLoadNumber: number }): React.JSX.Element {
  const addLoad = useAddDaysheetLoad(daysheetId);
  const [form, setForm] = useState({
    materialName: "",
    grossWeight: "",
    tareWeight: "",
    quantity: "",
    docketNumber: "",
  });

  function updateForm(field: string, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(): Promise<void> {
    try {
      await addLoad.mutateAsync({
        loadNumber: nextLoadNumber,
        materialName: form.materialName || undefined,
        grossWeight: form.grossWeight ? parseFloat(form.grossWeight) : undefined,
        tareWeight: form.tareWeight ? parseFloat(form.tareWeight) : undefined,
        quantity: form.quantity ? parseFloat(form.quantity) : undefined,
        docketNumber: form.docketNumber || undefined,
      });
      toast.success("Load added");
      setForm({ materialName: "", grossWeight: "", tareWeight: "", quantity: "", docketNumber: "" });
    } catch {
      toast.error("Failed to add load");
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Load
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Load #{nextLoadNumber}</DialogTitle>
          <DialogDescription>Record a load within this daysheet</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Material</Label>
            <Input value={form.materialName} onChange={(e) => updateForm("materialName", e.target.value)} placeholder="e.g. Fill Sand" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Gross Weight (t)</Label>
              <Input type="number" step="0.01" value={form.grossWeight} onChange={(e) => updateForm("grossWeight", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tare Weight (t)</Label>
              <Input type="number" step="0.01" value={form.tareWeight} onChange={(e) => updateForm("tareWeight", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" step="0.01" value={form.quantity} onChange={(e) => updateForm("quantity", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Docket Number</Label>
              <Input value={form.docketNumber} onChange={(e) => updateForm("docketNumber", e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={() => void handleSubmit()} disabled={addLoad.isPending}>
              Add Load
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
