import { useState, useMemo } from "react";
import { Link } from "react-router";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  List,
  Rows3,
  Search,
  Truck,
  User,
  Building2,
  AlertTriangle,
  Plus,
} from "lucide-react";
import {
  useSchedulingJobs,
  useSchedulingConflicts,
} from "@frontend/api/scheduling.js";
import type {
  SchedulingJob,
  SchedulingJobAssignment,
  SchedulingParams,
  ConflictEntry,
} from "@frontend/api/scheduling.js";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@frontend/components/ui/popover.js";
import { Calendar } from "@frontend/components/ui/calendar.js";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@frontend/components/ui/tooltip.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { Separator } from "@frontend/components/ui/separator.js";
import { SchedulerAllocationDialog } from "@frontend/components/scheduling/allocation-dialog.js";

// ── Helpers ──

function toDateString(date: Date): string {
  return date.toISOString().split("T")[0] ?? "";
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";

  return d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(isoStr: string | null): string {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
}

type DisplayMode = "line" | "multiline";
type GroupBy = "customer" | "project" | "none";
type AllocationFilter = "all" | "allocated" | "unallocated";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  quoted: "outline",
  scheduled: "secondary",
  confirmed: "default",
  in_progress: "default",
  completed: "secondary",
  invoiced: "secondary",
  cancelled: "destructive",
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
};

const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

interface GroupedJobs {
  label: string;
  id: string;
  jobs: SchedulingJob[];
}

function groupJobs(jobs: SchedulingJob[], groupBy: GroupBy): GroupedJobs[] {
  if (groupBy === "none") {
    return [{ label: "All Jobs", id: "all", jobs }];
  }

  const map = new Map<string, GroupedJobs>();

  for (const job of jobs) {
    let key: string;
    let label: string;

    if (groupBy === "customer") {
      key = job.customerId ?? "unassigned";
      label = job.customerName ?? "No Customer";
    } else {
      key = job.projectId ?? "unassigned";
      label = job.projectName
        ? `${job.projectNumber ?? ""} — ${job.projectName}`
        : "No Project";
    }

    const existing = map.get(key);
    if (existing) {
      existing.jobs.push(job);
    } else {
      map.set(key, { label, id: key, jobs: [job] });
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.id === "unassigned") return 1;
    if (b.id === "unassigned") return -1;
    return a.label.localeCompare(b.label);
  });
}

function getAssignmentLabel(a: SchedulingJobAssignment): string {
  if (a.assignmentType === "asset") {
    return [a.assetRegistration, a.assetMake, a.assetModel].filter(Boolean).join(" ") || "Unknown Asset";
  }
  if (a.assignmentType === "driver") {
    return a.employeeName ?? "Unknown Driver";
  }
  return a.contractorName ?? "Unknown Contractor";
}

function getAssignmentIcon(type: string): typeof Truck {
  if (type === "asset") return Truck;
  if (type === "driver") return User;
  return Building2;
}

function getLocationSummary(job: SchedulingJob): string {
  const pickups = job.locations.filter((l) => l.locationType === "pickup");
  const deliveries = job.locations.filter((l) => l.locationType === "delivery");
  const pickup = pickups[0];
  const delivery = deliveries[0];

  const parts: string[] = [];
  if (pickup) parts.push(pickup.addressSuburb ?? pickup.addressStreet ?? "Pickup");
  if (delivery) parts.push(delivery.addressSuburb ?? delivery.addressStreet ?? "Delivery");
  return parts.join(" → ") || "—";
}

function isResourceConflicted(
  resourceType: "asset" | "driver",
  resourceId: string,
  conflicts: ConflictEntry[],
): ConflictEntry | undefined {
  return conflicts.find(
    (c) => c.resourceType === resourceType && c.resourceId === resourceId,
  );
}

// ── Main Component ──

export function SchedulingPage(): React.JSX.Element {
  const { can } = useAuth();

  // Date navigation
  const today = toDateString(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // View state
  const [displayMode, setDisplayMode] = useState<DisplayMode>("line");
  const [groupBy, setGroupBy] = useState<GroupBy>("customer");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [jobTypeFilter, setJobTypeFilter] = useState<string>("");
  const [allocationFilter, setAllocationFilter] = useState<AllocationFilter>("all");

  // Allocation dialog
  const [allocationJobId, setAllocationJobId] = useState<string | null>(null);
  const allocationJob = useMemo(() => {
    if (!allocationJobId) return null;
    return schedulingData?.jobs.find((j) => j.id === allocationJobId) ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocationJobId]);

  // Build query params
  const params: SchedulingParams = {
    date: selectedDate,
    search: search || undefined,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    jobTypeId: jobTypeFilter || undefined,
    allocationStatus: allocationFilter,
    groupBy,
  };

  const { data: schedulingData, isPending, error } = useSchedulingJobs(params);
  const { data: conflictsData } = useSchedulingConflicts(selectedDate);
  const { data: jobTypesData } = useJobTypes({ isActive: true });
  const jobTypesList = jobTypesData?.data ?? [];
  const conflicts = conflictsData?.conflicts ?? [];

  // Date tabs: yesterday, today, tomorrow, +2, +3, +4
  const dateTabs = useMemo(() => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    return [
      { date: toDateString(addDays(todayDate, -1)), label: "Yesterday" },
      { date: toDateString(todayDate), label: "Today" },
      { date: toDateString(addDays(todayDate, 1)), label: "Tomorrow" },
      { date: toDateString(addDays(todayDate, 2)), label: formatDateLabel(toDateString(addDays(todayDate, 2))) },
      { date: toDateString(addDays(todayDate, 3)), label: formatDateLabel(toDateString(addDays(todayDate, 3))) },
      { date: toDateString(addDays(todayDate, 4)), label: formatDateLabel(toDateString(addDays(todayDate, 4))) },
    ];
  }, []);

  const groups = useMemo(
    () => groupJobs(schedulingData?.jobs ?? [], groupBy),
    [schedulingData?.jobs, groupBy],
  );

  const summary = schedulingData?.summary ?? { total: 0, allocated: 0, unallocated: 0, assignmentCount: 0 };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Scheduling</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateFull(selectedDate)} — {summary.total} jobs, {summary.assignmentCount} allocations
          </p>
        </div>
        <div className="flex items-center gap-2">
          {conflicts.length > 0 ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="space-y-1 text-xs">
                    {conflicts.map((c) => (
                      <div key={`${c.resourceType}-${c.resourceId}`}>
                        <span className="font-medium">{c.resourceLabel}</span>
                        {" — "}
                        {c.jobs.length} jobs
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
          {can("create:jobs") ? (
            <Button asChild size="sm">
              <Link to="/jobs/new">
                <Plus className="h-4 w-4" />
                New Job
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setSelectedDate(toDateString(addDays(new Date(selectedDate + "T00:00:00"), -1)))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex gap-1 overflow-x-auto">
          {dateTabs.map((tab) => (
            <Button
              key={tab.date}
              variant={selectedDate === tab.date ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSelectedDate(tab.date)}
              className="whitespace-nowrap"
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setSelectedDate(toDateString(addDays(new Date(selectedDate + "T00:00:00"), 1)))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <CalendarIcon className="h-4 w-4" />
              Pick Date
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={new Date(selectedDate + "T00:00:00")}
              onSelect={(date) => {
                if (date) {
                  setSelectedDate(toDateString(date));
                  setCalendarOpen(false);
                }
              }}
            />
          </PopoverContent>
        </Popover>

        {selectedDate !== today ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(today)}
          >
            Go to Today
          </Button>
        ) : null}
      </div>

      {/* Toolbar */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <form
            className="relative w-full max-w-sm"
            onSubmit={(e) => e.preventDefault()}
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search jobs, assets, drivers, locations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9"
            />
          </form>

          <div className="flex flex-wrap items-center gap-2">
            {/* Display mode toggle */}
            <div className="flex rounded-md border">
              <Button
                variant={displayMode === "line" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-r-none border-r px-2"
                onClick={() => setDisplayMode("line")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={displayMode === "multiline" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-l-none px-2"
                onClick={() => setDisplayMode("multiline")}
              >
                <Rows3 className="h-4 w-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Group by */}
            <div className="flex gap-1">
              {(["customer", "project", "none"] as const).map((g) => (
                <Button
                  key={g}
                  variant={groupBy === g ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setGroupBy(g)}
                >
                  {g === "none" ? "Flat" : g === "customer" ? "Customer" : "Project"}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2 border-t px-5 py-2">
          {/* Allocation status */}
          <div className="flex gap-1">
            {(["all", "allocated", "unallocated"] as const).map((af) => (
              <Button
                key={af}
                variant={allocationFilter === af ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setAllocationFilter(af)}
              >
                {af === "all" ? `All (${summary.total})` : af === "allocated" ? `Allocated (${summary.allocated})` : `Unallocated (${summary.unallocated})`}
              </Button>
            ))}
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Status */}
          <div className="flex gap-1">
            <Button
              variant={!statusFilter ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("")}
            >
              Any Status
            </Button>
            {["scheduled", "confirmed", "in_progress", "completed", "draft"].map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter(s)}
              >
                {STATUS_LABELS[s] ?? s}
              </Button>
            ))}
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Priority */}
          <div className="flex gap-1">
            <Button
              variant={!priorityFilter ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPriorityFilter("")}
            >
              All Priority
            </Button>
            {["high", "medium", "low"].map((p) => (
              <Button
                key={p}
                variant={priorityFilter === p ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setPriorityFilter(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Button>
            ))}
          </div>

          {jobTypesList.length > 0 ? (
            <>
              <Separator orientation="vertical" className="h-5" />
              <div className="flex gap-1">
                <Button
                  variant={!jobTypeFilter ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setJobTypeFilter("")}
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
            </>
          ) : null}
        </div>

        {/* Table */}
        <div className="border-t">
          {isPending ? (
            <div className="space-y-1 p-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-10 text-center text-destructive">
              Failed to load scheduling data. Please try again.
            </div>
          ) : schedulingData?.jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <CalendarIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">No jobs scheduled</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  No jobs found for {formatDateLabel(selectedDate)}.
                </p>
              </div>
            </div>
          ) : (
            <div>
              {groups.map((group) => (
                <div key={group.id}>
                  {groupBy !== "none" ? (
                    <div className="flex items-center gap-2 bg-muted/50 px-5 py-2 text-sm font-medium">
                      <span>{group.label}</span>
                      <Badge variant="secondary" className="text-xs">
                        {group.jobs.length}
                      </Badge>
                    </div>
                  ) : null}

                  {displayMode === "line" ? (
                    <LineView
                      jobs={group.jobs}
                      conflicts={conflicts}
                      canManage={can("manage:jobs")}
                      onAllocate={setAllocationJobId}
                    />
                  ) : (
                    <MultiLineView
                      jobs={group.jobs}
                      conflicts={conflicts}
                      canManage={can("manage:jobs")}
                      onAllocate={setAllocationJobId}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Allocation Dialog */}
      {allocationJobId && allocationJob ? (
        <SchedulerAllocationDialog
          open={Boolean(allocationJobId)}
          onOpenChange={(open) => {
            if (!open) setAllocationJobId(null);
          }}
          jobId={allocationJobId}
          jobNumber={allocationJob.jobNumber}
          jobName={allocationJob.name}
          date={selectedDate}
          existingAssignments={allocationJob.assignments}
        />
      ) : null}
    </div>
  );
}

// ── Line View ──

function LineView({
  jobs,
  conflicts,
  canManage,
  onAllocate,
}: {
  jobs: SchedulingJob[];
  conflicts: ConflictEntry[];
  canManage: boolean;
  onAllocate: (jobId: string) => void;
}): React.JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Job #</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Locations</TableHead>
          <TableHead className="text-center">Alloc</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Time</TableHead>
          {canManage ? <TableHead className="w-[120px]" /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => {
          const hasConflict = job.assignments.some((a) => {
            if (a.assignmentType === "asset" && a.assetId) {
              return isResourceConflicted("asset", a.assetId, conflicts);
            }
            if (a.assignmentType === "driver" && a.employeeId) {
              return isResourceConflicted("driver", a.employeeId, conflicts);
            }
            return false;
          });

          return (
            <TableRow key={job.id} className={hasConflict ? "bg-destructive/5" : undefined}>
              <TableCell>
                <Link
                  to={`/jobs/${job.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {job.jobNumber}
                </Link>
              </TableCell>
              <TableCell className="max-w-[180px] truncate text-sm">
                {job.name}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {job.jobTypeName ?? "—"}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {job.customerName ?? "—"}
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                {getLocationSummary(job)}
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <span className={`text-sm font-medium ${job.assignmentCount === 0 ? "text-muted-foreground" : ""}`}>
                    {job.assignmentCount}
                  </span>
                  {hasConflict ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[job.status] ?? "secondary"} className="text-xs">
                  {STATUS_LABELS[job.status] ?? job.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={PRIORITY_VARIANT[job.priority] ?? "outline"} className="text-xs">
                  {job.priority}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(job.scheduledStart)}
                </div>
              </TableCell>
              {canManage ? (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onAllocate(job.id)}
                    >
                      <Plus className="h-3 w-3" />
                      Allocate
                    </Button>
                  </div>
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ── Multi-line View (one row per assignment) ──

function MultiLineView({
  jobs,
  conflicts,
  canManage,
  onAllocate,
}: {
  jobs: SchedulingJob[];
  conflicts: ConflictEntry[];
  canManage: boolean;
  onAllocate: (jobId: string) => void;
}): React.JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Job #</TableHead>
          <TableHead>Name / Customer</TableHead>
          <TableHead>Locations</TableHead>
          <TableHead>Resource</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Arrival</TableHead>
          <TableHead>Status</TableHead>
          {canManage ? <TableHead className="w-[100px]" /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => {
          if (job.assignments.length === 0) {
            // Unallocated job — single row
            return (
              <TableRow key={job.id} className="bg-muted/30">
                <TableCell>
                  <Link
                    to={`/jobs/${job.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {job.jobNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{job.name}</div>
                  <div className="text-xs text-muted-foreground">{job.customerName ?? "—"}</div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {getLocationSummary(job)}
                </TableCell>
                <TableCell colSpan={2}>
                  <span className="text-sm italic text-muted-foreground">No allocations</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatTime(job.scheduledStart)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[job.status] ?? "secondary"} className="text-xs">
                    {STATUS_LABELS[job.status] ?? job.status}
                  </Badge>
                </TableCell>
                {canManage ? (
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onAllocate(job.id)}
                    >
                      <Plus className="h-3 w-3" />
                      Allocate
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            );
          }

          // One row per assignment
          return job.assignments.map((assignment, idx) => {
            const Icon = getAssignmentIcon(assignment.assignmentType);
            const conflict =
              assignment.assignmentType === "asset" && assignment.assetId
                ? isResourceConflicted("asset", assignment.assetId, conflicts)
                : assignment.assignmentType === "driver" && assignment.employeeId
                  ? isResourceConflicted("driver", assignment.employeeId, conflicts)
                  : undefined;

            return (
              <TableRow
                key={`${job.id}-${assignment.id}`}
                className={conflict ? "bg-destructive/5" : undefined}
              >
                {idx === 0 ? (
                  <>
                    <TableCell rowSpan={job.assignments.length}>
                      <Link
                        to={`/jobs/${job.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {job.jobNumber}
                      </Link>
                    </TableCell>
                    <TableCell rowSpan={job.assignments.length}>
                      <div className="text-sm">{job.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {job.customerName ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell rowSpan={job.assignments.length} className="text-sm text-muted-foreground">
                      {getLocationSummary(job)}
                    </TableCell>
                  </>
                ) : null}
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">{getAssignmentLabel(assignment)}</span>
                    {conflict ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <span className="text-xs">
                              Also on: {conflict.jobs.filter((j) => j.jobId !== job.id).map((j) => j.jobNumber).join(", ")}
                            </span>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {assignment.assetCategoryName
                    ? `${assignment.assetCategoryName}${assignment.assetSubcategoryName ? ` / ${assignment.assetSubcategoryName}` : ""}`
                    : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatTime(assignment.plannedStart ?? job.scheduledStart)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={assignment.status === "in_progress" ? "default" : assignment.status === "completed" ? "secondary" : "outline"}
                    className="text-xs"
                  >
                    {assignment.status}
                  </Badge>
                </TableCell>
                {canManage && idx === 0 ? (
                  <TableCell rowSpan={job.assignments.length} className="text-right align-top">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onAllocate(job.id)}
                    >
                      <Plus className="h-3 w-3" />
                      Allocate
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            );
          });
        })}
      </TableBody>
    </Table>
  );
}
