import { useParams, Link } from "react-router";
import { ArrowLeft, CheckCircle, Send, DollarSign, Plus, Trash2 } from "lucide-react";
import {
  useRcti,
  useApproveRcti,
  useTransitionRcti,
  useAddRctiDeduction,
  useDeleteRctiDeduction,
  useRecordRctiPayment,
} from "@frontend/api/rctis.js";
import type { RctiLineItem, RctiPayment } from "@frontend/api/rctis.js";
import { useAuth } from "@frontend/hooks/use-auth.js";
import { Button } from "@frontend/components/ui/button.js";
import { Badge } from "@frontend/components/ui/badge.js";
import {
  Card,
  CardContent,
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@frontend/components/ui/dialog.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  accumulating: "outline",
  ready: "default",
  pending_approval: "outline",
  approved: "default",
  sent: "default",
  partially_paid: "outline",
  paid: "default",
  cancelled: "secondary",
  disputed: "destructive",
};

function formatCurrency(val: string | null): string {
  if (!val) return "$0.00";
  const n = parseFloat(val);
  return isNaN(n) ? "$0.00" : `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function RctiDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { data: rcti, isLoading } = useRcti(id ?? "");
  const approve = useApproveRcti(id ?? "");
  const transition = useTransitionRcti(id ?? "");

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;

  if (!rcti) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <p>RCTI not found</p>
        <Button variant="outline" asChild className="mt-4">
          <Link to="/rctis">Back to RCTIs</Link>
        </Button>
      </div>
    );
  }

  const canManage = can("manage:rcti");
  const canApprove = can("approve:rcti");
  const chargeLines = rcti.lineItems.filter((l: RctiLineItem) => l.lineType === "charge");
  const deductionLines = rcti.lineItems.filter((l: RctiLineItem) => l.lineType === "deduction");
  const isEditable = !["approved", "sent", "partially_paid", "paid", "cancelled"].includes(rcti.status);
  const outstanding = parseFloat(rcti.total) - parseFloat(rcti.amountPaid);

  async function handleApprove(): Promise<void> {
    try {
      await approve.mutateAsync({});
      toast.success("RCTI approved");
    } catch {
      toast.error("Failed to approve RCTI");
    }
  }

  async function handleSend(): Promise<void> {
    try {
      await transition.mutateAsync({ status: "sent" });
      toast.success("RCTI marked as sent");
    } catch {
      toast.error("Failed to send RCTI");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/rctis"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{rcti.rctiNumber}</h1>
            <Badge variant={STATUS_VARIANTS[rcti.status] ?? "secondary"}>
              {rcti.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {rcti.contractorName} — Period {rcti.periodStart} to {rcti.periodEnd}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(rcti.status === "ready" || rcti.status === "pending_approval") && canApprove && (
            <Button onClick={() => void handleApprove()} disabled={approve.isPending}>
              <CheckCircle className="mr-2 h-4 w-4" />Approve
            </Button>
          )}
          {rcti.status === "approved" && canManage && (
            <Button onClick={() => void handleSend()} disabled={transition.isPending}>
              <Send className="mr-2 h-4 w-4" />Mark Sent
            </Button>
          )}
          {(rcti.status === "sent" || rcti.status === "partially_paid") && canManage && (
            <RecordPaymentDialog rctiId={id ?? ""} outstanding={outstanding} />
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Subtotal</div><div className="text-2xl font-bold">{formatCurrency(rcti.subtotal)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Deductions</div><div className="text-2xl font-bold text-destructive">-{formatCurrency(rcti.deductionsTotal)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Net Total</div><div className="text-2xl font-bold">{formatCurrency(rcti.total)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Paid</div><div className="text-2xl font-bold text-green-600">{formatCurrency(rcti.amountPaid)}</div></CardContent></Card>
      </div>

      {/* Charge Lines */}
      <Card>
        <CardHeader><CardTitle>Work Items ({chargeLines.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chargeLines.map((line: RctiLineItem) => (
                <TableRow key={line.id}>
                  <TableCell className="text-muted-foreground">{line.lineNumber}</TableCell>
                  <TableCell>{line.description}</TableCell>
                  <TableCell className="text-muted-foreground">{line.sourceJobNumber ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{line.assetRegistration ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">{parseFloat(line.quantity).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(line.unitPrice)}</TableCell>
                  <TableCell className="text-right font-mono font-medium">{formatCurrency(line.lineTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Deductions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Deductions ({deductionLines.length})</CardTitle>
            {isEditable && canManage && (
              <AddDeductionDialog rctiId={id ?? ""} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {deductionLines.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">No deductions</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {isEditable && canManage && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {deductionLines.map((line: RctiLineItem) => (
                  <DeductionRow key={line.id} line={line} rctiId={id ?? ""} canEdit={isEditable && canManage} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payments */}
      {rcti.payments.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Payments ({rcti.payments.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rcti.payments.map((p: RctiPayment) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.paymentDate}</TableCell>
                    <TableCell className="capitalize">{p.paymentMethod.replace(/_/g, " ")}</TableCell>
                    <TableCell>{p.referenceNumber ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono font-medium">{formatCurrency(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DeductionRow({ line, rctiId, canEdit }: { line: RctiLineItem; rctiId: string; canEdit: boolean }): React.JSX.Element {
  const deleteDeduction = useDeleteRctiDeduction(rctiId);

  return (
    <TableRow>
      <TableCell>
        <Badge variant="outline">{(line.deductionCategory ?? "other").replace(/_/g, " ")}</Badge>
      </TableCell>
      <TableCell>{line.description}</TableCell>
      <TableCell className="text-right font-mono text-destructive">
        -{formatCurrency(line.unitPrice)}
      </TableCell>
      {canEdit && (
        <TableCell>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => void deleteDeduction.mutateAsync(line.id)}
            disabled={deleteDeduction.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}

function AddDeductionDialog({ rctiId }: { rctiId: string }): React.JSX.Element {
  const addDeduction = useAddRctiDeduction(rctiId);
  const [form, setForm] = useState({ category: "fuel_usage", description: "", amount: "", details: "" });

  function updateForm(field: string, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(): Promise<void> {
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0 || !form.description.trim()) return;
    try {
      await addDeduction.mutateAsync({
        deductionCategory: form.category,
        description: form.description,
        amount,
        details: form.details || undefined,
      });
      toast.success("Deduction added");
      setForm({ category: "fuel_usage", description: "", amount: "", details: "" });
    } catch {
      toast.error("Failed to add deduction");
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" />Add Deduction</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Deduction</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.category} onChange={(e) => updateForm("category", e.target.value)}>
              <option value="yard_parking">Yard Parking</option>
              <option value="fuel_usage">Fuel Usage</option>
              <option value="overload_penalty">Overload Penalty</option>
              <option value="tip_fee_adjustment">Tip Fee Adjustment</option>
              <option value="driver_error">Driver Error</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => updateForm("description", e.target.value)} placeholder="e.g. Fuel top-up 200L" />
          </div>
          <div className="space-y-2">
            <Label>Amount ($)</Label>
            <Input type="number" step="0.01" value={form.amount} onChange={(e) => updateForm("amount", e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label>Details (optional)</Label>
            <Input value={form.details} onChange={(e) => updateForm("details", e.target.value)} placeholder="Additional context" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <DialogClose asChild>
            <Button onClick={() => void handleSubmit()} disabled={addDeduction.isPending}>Add Deduction</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentDialog({ rctiId, outstanding }: { rctiId: string; outstanding: number }): React.JSX.Element {
  const recordPayment = useRecordRctiPayment(rctiId);
  const [form, setForm] = useState({ paymentDate: new Date().toISOString().slice(0, 10), amount: "", paymentMethod: "eft", referenceNumber: "" });

  function updateForm(field: string, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(): Promise<void> {
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) return;
    try {
      await recordPayment.mutateAsync({
        paymentDate: form.paymentDate,
        amount,
        paymentMethod: form.paymentMethod,
        referenceNumber: form.referenceNumber || undefined,
      });
      toast.success("Payment recorded");
      setForm({ paymentDate: new Date().toISOString().slice(0, 10), amount: "", paymentMethod: "eft", referenceNumber: "" });
    } catch {
      toast.error("Failed to record payment");
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button><DollarSign className="mr-2 h-4 w-4" />Record Payment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record Payment — Outstanding {formatCurrency(String(outstanding))}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={form.paymentDate} onChange={(e) => updateForm("paymentDate", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => updateForm("amount", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Method</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.paymentMethod} onChange={(e) => updateForm("paymentMethod", e.target.value)}>
                <option value="eft">EFT</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={form.referenceNumber} onChange={(e) => updateForm("referenceNumber", e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <DialogClose asChild><Button onClick={() => void handleSubmit()} disabled={recordPayment.isPending}>Record</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
