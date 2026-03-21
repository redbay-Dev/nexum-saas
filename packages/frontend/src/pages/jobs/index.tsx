import { useState } from "react";
import { Link } from "react-router";
import { Briefcase, Plus, Search } from "lucide-react";
import { useJobs, useDeleteJob } from "@frontend/api/jobs.js";
import { useJobTypes } from "@frontend/api/job-types.js";
import { useAuth } from "@frontend/hooks/use-auth.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Badge } from "@frontend/components/ui/badge.js";
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

type StatusFilter = "all" | "draft" | "quoted" | "scheduled" | "confirmed" | "in_progress" | "completed" | "invoiced" | "cancelled";
type PriorityFilter = "all" | "low" | "medium" | "high";

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "quoted", label: "Quoted" },
  { value: "scheduled", label: "Scheduled" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "invoiced", label: "Invoiced" },
  { value: "cancelled", label: "Cancelled" },
];

const PRIORITY_TABS: Array<{ value: PriorityFilter; label: string }> = [
  { value: "all", label: "All Priorities" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  quoted: "outline",
  scheduled: "secondary",
  confirmed: "default",
  in_progress: "default",
  completed: "secondary",
  invoiced: "secondary",
  cancelled: "destructive",
  declined: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  quoted: "Quoted",
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  in_progress: "In Progress",
  completed: "Completed",
  invoiced: "Invoiced",
  cancelled: "Cancelled",
  declined: "Declined",
};

const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

export function JobsPage(): React.JSX.Element {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [jobTypeFilter, setJobTypeFilter] = useState<string>("all");
  const deleteJob = useDeleteJob();

  const { data: jobTypesData } = useJobTypes({ isActive: true });
  const jobTypesList = jobTypesData?.data ?? [];

  const { data, isPending, error } = useJobs({
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter,
    jobTypeId: jobTypeFilter === "all" ? undefined : jobTypeFilter,
  });

  function handleDelete(id: string, label: string): void {
    if (!confirm(`Are you sure you want to delete "${label}"?`)) return;
    deleteJob.mutate(id, {
      onSuccess: () => toast.success(`Deleted "${label}"`),
      onError: () => toast.error("Failed to delete job"),
    });
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Jobs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage transport, disposal, hire, and on-site jobs.
          </p>
        </div>
        {can("create:jobs") ? (
          <Button asChild>
            <Link to="/jobs/new">
              <Plus className="h-4 w-4" />
              New Job
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <form
            className="relative w-full max-w-sm"
            onSubmit={(e) => e.preventDefault()}
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search job #, name, PO..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9"
            />
          </form>
          <div className="flex flex-wrap gap-3">
            {jobTypesList.length > 0 ? (
              <div className="flex gap-1">
                <Button
                  variant={jobTypeFilter === "all" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setJobTypeFilter("all")}
                >
                  All Types
                </Button>
                {jobTypesList.map((jt) => (
                  <Button
                    key={jt.id}
                    variant={jobTypeFilter === jt.id ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setJobTypeFilter(jt.id)}
                  >
                    {jt.name}
                  </Button>
                ))}
              </div>
            ) : null}
            <div className="flex gap-1">
              {PRIORITY_TABS.map((tab) => (
                <Button
                  key={tab.value}
                  variant={priorityFilter === tab.value ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setPriorityFilter(tab.value)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t px-6 py-2">
          <div className="flex gap-1 overflow-x-auto">
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

        <div className="border-t">
          {isPending ? (
            <div className="space-y-1 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-10 text-center text-destructive">
              Failed to load jobs. Please try again.
            </div>
          ) : data?.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
                <Briefcase className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">No jobs yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create your first job to get started.
                </p>
              </div>
              {can("create:jobs") ? (
                <Button size="sm" asChild>
                  <Link to="/jobs/new">
                    <Plus className="h-4 w-4" />
                    New Job
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Scheduled</TableHead>
                  {can("manage:jobs") ? (
                    <TableHead className="w-[100px]" />
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Link
                        to={`/jobs/${job.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {job.jobNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {job.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {job.jobTypeName ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.customerName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[job.status] ?? "secondary"}>
                        {STATUS_LABELS[job.status] ?? job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={PRIORITY_VARIANT[job.priority] ?? "outline"}>
                        {job.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(job.scheduledStart)}
                    </TableCell>
                    {can("manage:jobs") ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/jobs/${job.id}`}>View</Link>
                          </Button>
                          {job.status !== "invoiced" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() =>
                                handleDelete(job.id, job.jobNumber)
                              }
                            >
                              Delete
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {data && data.data.length > 0 ? (
          <div className="border-t px-6 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {data.data.length} of {data.total ?? data.data.length} jobs
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
