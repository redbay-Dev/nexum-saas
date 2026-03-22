import { useState } from "react";
import { Link } from "react-router";
import { CheckSquare, Check, X } from "lucide-react";
import { useArQueue, useApproveJob, useBatchApproveJobs } from "@frontend/api/invoices.js";
import { Button } from "@frontend/components/ui/button.js";
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
import { toast } from "sonner";

const AR_STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
};

export function ArApprovalsPage(): React.JSX.Element {
  const { data, isLoading } = useArQueue();
  const approveJob = useApproveJob();
  const batchApprove = useBatchApproveJobs();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const queue = data?.data ?? [];
  const pendingJobs = queue.filter((j) => j.arStatus === "pending");

  function toggleSelect(jobId: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  function toggleSelectAll(): void {
    if (selected.size === pendingJobs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingJobs.map((j) => j.id)));
    }
  }

  async function handleApprove(jobId: string): Promise<void> {
    try {
      await approveJob.mutateAsync({ jobId, decision: "approved" });
      toast.success("Job approved for invoicing");
    } catch {
      toast.error("Failed to approve job");
    }
  }

  async function handleReject(jobId: string): Promise<void> {
    try {
      await approveJob.mutateAsync({ jobId, decision: "rejected", notes: "Rejected from AR queue" });
      toast.success("Job rejected");
    } catch {
      toast.error("Failed to reject job");
    }
  }

  async function handleBatchApprove(): Promise<void> {
    if (selected.size === 0) return;
    try {
      const result = await batchApprove.mutateAsync({ jobIds: [...selected] });
      toast.success(`${result.approved} jobs approved`);
      setSelected(new Set());
    } catch {
      toast.error("Failed to batch approve");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AR Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Review completed jobs before they can be invoiced
          </p>
        </div>
        {selected.size > 0 && (
          <Button onClick={() => void handleBatchApprove()} disabled={batchApprove.isPending}>
            <Check className="mr-2 h-4 w-4" />
            Approve {selected.size} Selected
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Completed Jobs</CardTitle>
          <CardDescription>
            {pendingJobs.length} pending approval, {queue.length} total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : queue.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <CheckSquare className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No jobs pending AR approval</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selected.size === pendingJobs.length && pendingJobs.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>AR Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      {job.arStatus === "pending" && (
                        <Checkbox
                          checked={selected.has(job.id)}
                          onCheckedChange={() => toggleSelect(job.id)}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Link to={`/jobs/${job.id}`} className="font-medium text-primary hover:underline">
                        {job.jobNumber ?? "—"} — {job.name}
                      </Link>
                    </TableCell>
                    <TableCell>{job.customerName ?? "—"}</TableCell>
                    <TableCell>{job.projectName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={AR_STATUS_VARIANTS[job.arStatus] ?? "secondary"}>
                        {job.arStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {job.arStatus === "pending" && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleApprove(job.id)}
                            disabled={approveJob.isPending}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleReject(job.id)}
                            disabled={approveJob.isPending}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="mr-1 h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </div>
                      )}
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
