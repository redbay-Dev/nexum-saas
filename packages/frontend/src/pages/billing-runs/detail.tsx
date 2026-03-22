import { Link, useParams } from "react-router";
import { ArrowLeft, CheckCircle2, Send, FileText } from "lucide-react";
import {
  useBillingRun,
  useBatchVerifyInvoices,
  useBatchSendInvoices,
} from "@frontend/api/billing-runs.js";
import { Button } from "@frontend/components/ui/button.js";
import { Badge } from "@frontend/components/ui/badge.js";
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

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  generating: "secondary",
  generated: "default",
  completed: "default",
  failed: "destructive",
  invoiced: "default",
  skipped: "secondary",
  error: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  generating: "Generating",
  generated: "Generated",
  completed: "Completed",
  failed: "Failed",
  invoiced: "Invoiced",
  skipped: "Skipped",
  error: "Error",
};

function formatCurrency(val: string | null): string {
  if (!val) return "$0.00";
  const n = parseFloat(val);
  return isNaN(n) ? "$0.00" : `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function BillingRunDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { data: run, isLoading } = useBillingRun(id ?? "");
  const batchVerify = useBatchVerifyInvoices();
  const batchSend = useBatchSendInvoices();

  async function handleBatchVerify(): Promise<void> {
    if (!run) return;
    const invoiceIds = run.items
      .filter((item) => item.invoiceId !== null)
      .map((item) => item.invoiceId as string);
    if (invoiceIds.length === 0) {
      toast.error("No invoices to verify");
      return;
    }
    try {
      const result = await batchVerify.mutateAsync({ invoiceIds });
      toast.success(`Verified ${result.verified} invoices`);
    } catch {
      toast.error("Batch verify failed");
    }
  }

  async function handleBatchSend(): Promise<void> {
    if (!run) return;
    const invoiceIds = run.items
      .filter((item) => item.invoiceId !== null)
      .map((item) => item.invoiceId as string);
    if (invoiceIds.length === 0) {
      toast.error("No invoices to send");
      return;
    }
    try {
      const result = await batchSend.mutateAsync({ invoiceIds });
      toast.success(`Sent ${result.sent} invoices`);
    } catch {
      toast.error("Batch send failed");
    }
  }

  if (isLoading || !run) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const items = run.items ?? [];
  const totalEstimated = items.reduce((sum, item) => sum + parseFloat(item.estimatedTotal || "0"), 0);
  const totalActual = items.reduce((sum, item) => sum + parseFloat(item.actualTotal || "0"), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/billing-runs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Billing Run {run.runNumber}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(run.periodStart)} -- {formatDate(run.periodEnd)}
            </p>
          </div>
          <Badge variant={STATUS_VARIANTS[run.status] ?? "secondary"} className="ml-2">
            {STATUS_LABELS[run.status] ?? run.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          {(run.status === "generated" || run.status === "pending") && (
            <Button
              variant="outline"
              onClick={() => void handleBatchVerify()}
              disabled={batchVerify.isPending}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Batch Verify
            </Button>
          )}
          {run.status === "generated" && (
            <Button
              onClick={() => void handleBatchSend()}
              disabled={batchSend.isPending}
            >
              <Send className="mr-2 h-4 w-4" />
              Batch Send
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-semibold">{run.invoiceCount}</p>
            <p className="text-xs text-muted-foreground">Invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-semibold font-mono">{formatCurrency(run.totalAmount)}</p>
            <p className="text-xs text-muted-foreground">Total Amount</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-semibold">{items.length}</p>
            <p className="text-xs text-muted-foreground">Customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-semibold">{run.generatedByName ?? "--"}</p>
            <p className="text-xs text-muted-foreground">Generated By</p>
          </CardContent>
        </Card>
      </div>

      {run.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{run.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing Run Items</CardTitle>
          <CardDescription>
            Invoices grouped by customer
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No items in this billing run</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Jobs</TableHead>
                    <TableHead className="text-right">Estimated Total</TableHead>
                    <TableHead className="text-right">Actual Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.customerName ?? item.customerId}
                      </TableCell>
                      <TableCell className="text-right">{item.jobCount}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.estimatedTotal)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.actualTotal)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[item.status] ?? "outline"} className="capitalize">
                          {STATUS_LABELS[item.status] ?? item.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex justify-end border-t pt-4">
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Total Estimated:</span>
                  <span className="text-right font-mono font-medium">
                    {formatCurrency(String(totalEstimated))}
                  </span>
                  <span className="text-muted-foreground">Total Actual:</span>
                  <span className="text-right font-mono font-medium">
                    {formatCurrency(String(totalActual))}
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
