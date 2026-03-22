import { useState } from "react";
import { Link } from "react-router";
import { Receipt, Search } from "lucide-react";
import { useRctis } from "@frontend/api/rctis.js";
import type { RctiListParams } from "@frontend/api/rctis.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Badge } from "@frontend/components/ui/badge.js";
import {
  Card,
  CardContent,
  CardHeader,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select.js";

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

export function RctisPage(): React.JSX.Element {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const params: RctiListParams = {};
  if (search) params.search = search;
  if (statusFilter && statusFilter !== "all") params.status = statusFilter;

  const { data, isLoading } = useRctis(params);
  const rctiList = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">RCTIs</h1>
          <p className="text-sm text-muted-foreground">
            Recipient Created Tax Invoices for contractor payments
          </p>
        </div>
        <Button asChild>
          <Link to="/rctis/generate">Generate RCTIs</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search RCTIs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="accumulating">Accumulating</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : rctiList.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Receipt className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No RCTIs found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RCTI #</TableHead>
                  <TableHead>Contractor</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rctiList.map((rcti) => (
                  <TableRow key={rcti.id}>
                    <TableCell>
                      <Link
                        to={`/rctis/${rcti.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {rcti.rctiNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{rcti.contractorName ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {rcti.periodStart} — {rcti.periodEnd}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(rcti.subtotal)}</TableCell>
                    <TableCell className="text-right font-mono text-destructive">
                      {parseFloat(rcti.deductionsTotal) > 0 ? `-${formatCurrency(rcti.deductionsTotal)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">{formatCurrency(rcti.total)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[rcti.status] ?? "secondary"}>
                        {rcti.status.replace(/_/g, " ")}
                      </Badge>
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
