import { useParams, Link } from "react-router";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Send,
  DollarSign,
} from "lucide-react";
import {
  useInvoice,
  useVerifyInvoice,
  useRejectInvoice,
  useTransitionInvoice,
  useRecordInvoicePayment,
} from "@frontend/api/invoices.js";
import type { InvoiceLineItem, InvoicePayment } from "@frontend/api/invoices.js";
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
import { Textarea } from "@frontend/components/ui/textarea.js";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  verified: "default",
  sent: "default",
  partially_paid: "outline",
  paid: "default",
  overdue: "destructive",
  rejected: "destructive",
  cancelled: "secondary",
};

function formatCurrency(val: string | null): string {
  if (!val) return "$0.00";
  const n = parseFloat(val);
  return isNaN(n) ? "$0.00" : `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNum(val: string | null, decimals: number = 2): string {
  if (!val) return "—";
  const n = parseFloat(val);
  return isNaN(n) ? "—" : n.toFixed(decimals);
}

export function InvoiceDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { data: invoice, isLoading } = useInvoice(id ?? "");
  const verify = useVerifyInvoice(id ?? "");
  const reject = useRejectInvoice(id ?? "");
  const transition = useTransitionInvoice(id ?? "");

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading...</div>;
  }

  if (!invoice) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <p>Invoice not found</p>
        <Button variant="outline" asChild className="mt-4">
          <Link to="/invoices">Back to Invoices</Link>
        </Button>
      </div>
    );
  }

  const canManage = can("manage:invoicing");
  const canVerify = can("verify:invoicing");
  const outstanding = parseFloat(invoice.total) - parseFloat(invoice.amountPaid);

  async function handleVerify(): Promise<void> {
    try {
      await verify.mutateAsync({});
      toast.success("Invoice verified");
    } catch {
      toast.error("Failed to verify invoice");
    }
  }

  async function handleSend(): Promise<void> {
    try {
      await transition.mutateAsync({ status: "sent" });
      toast.success("Invoice marked as sent");
    } catch {
      toast.error("Failed to send invoice");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/invoices">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{invoice.invoiceNumber}</h1>
            <Badge variant={STATUS_VARIANTS[invoice.status] ?? "secondary"}>
              {invoice.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {invoice.customerName} — Issued {invoice.issueDate}, Due {invoice.dueDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {invoice.status === "draft" && canVerify && (
            <Button onClick={() => void handleVerify()} disabled={verify.isPending}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Verify
            </Button>
          )}
          {invoice.status === "draft" && canVerify && (
            <RejectDialog reject={reject} />
          )}
          {invoice.status === "verified" && canManage && (
            <Button onClick={() => void handleSend()} disabled={transition.isPending}>
              <Send className="mr-2 h-4 w-4" />
              Mark Sent
            </Button>
          )}
          {(invoice.status === "sent" || invoice.status === "partially_paid" || invoice.status === "overdue") && canManage && (
            <RecordPaymentDialog invoiceId={id ?? ""} outstanding={outstanding} />
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Subtotal</div>
            <div className="text-2xl font-bold">{formatCurrency(invoice.subtotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="text-2xl font-bold">{formatCurrency(invoice.total)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Paid</div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(invoice.amountPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Outstanding</div>
            <div className={`text-2xl font-bold ${outstanding > 0 ? "text-orange-600" : "text-green-600"}`}>
              {formatCurrency(String(outstanding))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rejection reason */}
      {invoice.rejectionReason && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-destructive">Rejection Reason</div>
            <p className="mt-1">{invoice.rejectionReason}</p>
          </CardContent>
        </Card>
      )}

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items ({invoice.lineItems.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {invoice.lineItems.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">No line items</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lineItems.map((line: InvoiceLineItem) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-muted-foreground">{line.lineNumber}</TableCell>
                    <TableCell>
                      <div>{line.description}</div>
                      {line.calculationMethod && (
                        <div className="text-xs text-muted-foreground">{line.calculationMethod}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{line.sourceJobNumber ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">{formatNum(line.quantity)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(line.unitPrice)}</TableCell>
                    <TableCell className="text-right font-mono font-medium">{formatCurrency(line.lineTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payments */}
      {invoice.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payments ({invoice.payments.length})</CardTitle>
          </CardHeader>
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
                {invoice.payments.map((payment: InvoicePayment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.paymentDate}</TableCell>
                    <TableCell className="capitalize">{payment.paymentMethod.replace(/_/g, " ")}</TableCell>
                    <TableCell>{payment.referenceNumber ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono font-medium">{formatCurrency(payment.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {(invoice.notes ?? invoice.internalNotes) && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invoice.notes && <p>{invoice.notes}</p>}
            {invoice.internalNotes && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Internal: </span>
                <span>{invoice.internalNotes}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RejectDialog({ reject }: {
  reject: ReturnType<typeof useRejectInvoice>;
}): React.JSX.Element {
  const [reason, setReason] = useState("");

  async function handleReject(): Promise<void> {
    if (!reason.trim()) return;
    try {
      await reject.mutateAsync({ reason });
      toast.success("Invoice rejected");
      setReason("");
    } catch {
      toast.error("Failed to reject invoice");
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <XCircle className="mr-2 h-4 w-4" />
          Reject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Reason (required)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe why this invoice is being rejected..."
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              variant="destructive"
              onClick={() => void handleReject()}
              disabled={!reason.trim() || reject.isPending}
            >
              Reject Invoice
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentDialog({ invoiceId, outstanding }: {
  invoiceId: string;
  outstanding: number;
}): React.JSX.Element {
  const recordPayment = useRecordInvoicePayment(invoiceId);
  const [form, setForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: "",
    paymentMethod: "eft",
    referenceNumber: "",
    notes: "",
  });

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
        notes: form.notes || undefined,
      });
      toast.success("Payment recorded");
      setForm({ paymentDate: new Date().toISOString().slice(0, 10), amount: "", paymentMethod: "eft", referenceNumber: "", notes: "" });
    } catch {
      toast.error("Failed to record payment");
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <DollarSign className="mr-2 h-4 w-4" />
          Record Payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Outstanding: {formatCurrency(String(outstanding))}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input type="date" value={form.paymentDate} onChange={(e) => updateForm("paymentDate", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => updateForm("amount", e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Method</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.paymentMethod} onChange={(e) => updateForm("paymentMethod", e.target.value)}>
                <option value="eft">EFT</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
                <option value="credit_card">Credit Card</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={form.referenceNumber} onChange={(e) => updateForm("referenceNumber", e.target.value)} placeholder="Bank ref" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={() => void handleSubmit()} disabled={recordPayment.isPending}>
              Record Payment
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
