import { useState } from "react";
import { Link } from "react-router";
import { ClipboardList, Plus, Search, CheckCircle2 } from "lucide-react";
import { useDaysheets, useBatchProcessDaysheets } from "@frontend/api/daysheets.js";
import { useAuth } from "@frontend/hooks/use-auth.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Checkbox } from "@frontend/components/ui/checkbox.js";
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

type StatusFilter = "all" | "submitted" | "review" | "reconciled" | "processed" | "rejected";

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "review", label: "In Review" },
  { value: "reconciled", label: "Reconciled" },
  { value: "processed", label: "Processed" },
  { value: "rejected", label: "Rejected" },
];

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

const CHANNEL_LABELS: Record<string, string> = {
  driverx: "DriverX",
  portal: "Portal",
  staff_entry: "Staff",
  auto_generated: "Auto",
};

function formatWeight(weight: string | null): string {
  if (!weight) return "—";
  const n = parseFloat(weight);
  return isNaN(n) ? "—" : `${n.toFixed(2)}t`;
}

function formatHours(hours: string | null): string {
  if (!hours) return "—";
  const n = parseFloat(hours);
  return isNaN(n) ? "—" : `${n.toFixed(1)}h`;
}

export function DaysheetsPage(): React.JSX.Element {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const batchProcess = useBatchProcessDaysheets();

  const { data, isLoading } = useDaysheets({
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const items = data?.data ?? [];

  function toggleSelect(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(): void {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }

  async function handleBatchProcess(): Promise<void> {
    if (selected.size === 0) return;
    try {
      const result = await batchProcess.mutateAsync({
        daysheetIds: Array.from(selected),
      });
      toast.success(
        `Processed ${result.summary.processed}, skipped ${result.summary.skipped}, errors ${result.summary.errors}`,
      );
      setSelected(new Set());
    } catch {
      toast.error("Batch processing failed");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Daysheets</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Work records from drivers — the primary record of completed work
          </p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && can("approve:dockets") && (
            <Button
              variant="default"
              onClick={() => void handleBatchProcess()}
              disabled={batchProcess.isPending}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Process {selected.size} selected
            </Button>
          )}
          {can("manage:dockets") && (
            <Button asChild>
              <Link to="/daysheets/new">
                <Plus className="mr-2 h-4 w-4" />
                New Daysheet
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search daysheets..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {STATUS_TABS.map((tab) => (
            <Button
              key={tab.value}
              variant={statusFilter === tab.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={items.length > 0 && selected.size === items.length}
                  onCheckedChange={() => toggleSelectAll()}
                />
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead className="text-right">Weight / Hours</TableHead>
              <TableHead className="text-right">Loads</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                  <ClipboardList className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  No daysheets found
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link to={`/daysheets/${item.id}`} className="hover:underline">
                      {item.workDate}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{item.jobNumber}</span>
                    <br />
                    {item.jobName}
                  </TableCell>
                  <TableCell>{item.driverName ?? "—"}</TableCell>
                  <TableCell>{item.assetRegistration ?? "—"}</TableCell>
                  <TableCell>{item.customerName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {CHANNEL_LABELS[item.submissionChannel] ?? item.submissionChannel}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {item.totalNetWeight
                      ? formatWeight(item.totalNetWeight)
                      : formatHours(item.totalBillableHours)}
                  </TableCell>
                  <TableCell className="text-right">{item.loadCount ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[item.status] ?? "outline"}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && (
        <div className="text-xs text-muted-foreground">
          Showing {items.length} of {data.total ?? items.length} daysheets
        </div>
      )}
    </div>
  );
}
