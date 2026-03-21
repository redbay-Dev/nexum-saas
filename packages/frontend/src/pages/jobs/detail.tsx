import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import {
  useJob,
  useUpdateJob,
  useDeleteJob,
  useJobStatusTransition,
  useDeleteJobLocation,
  useDeleteJobMaterial,
  useDeleteJobAssetRequirement,
  useDeleteJobPricingLine,
  useDeleteJobAssignment,
  useUpdateJobAssignment,
} from "@frontend/api/jobs.js";
import { useAuth } from "@frontend/hooks/use-auth.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Textarea } from "@frontend/components/ui/textarea.js";
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
import { Separator } from "@frontend/components/ui/separator.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { toast } from "sonner";
import { getValidTransitions } from "@nexum/shared";
import type { JobStatus } from "@nexum/shared";
import { AddLocationDialog } from "@frontend/components/jobs/add-location-dialog.js";
import { AddMaterialDialog } from "@frontend/components/jobs/add-material-dialog.js";
import { AddAssetRequirementDialog } from "@frontend/components/jobs/add-asset-requirement-dialog.js";
import { AddPricingLineDialog } from "@frontend/components/jobs/add-pricing-line-dialog.js";
import { AddAssignmentDialog } from "@frontend/components/jobs/add-assignment-dialog.js";

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

export function JobDetailPage(): React.JSX.Element {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: job, isPending, error } = useJob(id);
  const updateJob = useUpdateJob(id);
  const deleteJob = useDeleteJob();
  const statusTransition = useJobStatusTransition(id);
  const deleteLocation = useDeleteJobLocation(id);
  const deleteMaterial = useDeleteJobMaterial(id);
  const deleteRequirement = useDeleteJobAssetRequirement(id);
  const deletePricingLine = useDeleteJobPricingLine(id);
  const deleteAssignment = useDeleteJobAssignment(id);
  const updateAssignment = useUpdateJobAssignment(id);

  const [isEditing, setIsEditing] = useState(false);
  const [transitionReason, setTransitionReason] = useState("");

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive">Job not found.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link to="/jobs">Back to Jobs</Link>
        </Button>
      </div>
    );
  }

  const isLocked = job.status === "invoiced";
  const validTransitions = getValidTransitions(job.status as JobStatus);

  function handleStatusTransition(toStatus: string): void {
    const needsReason = ["cancelled", "draft"].includes(toStatus) || toStatus === "in_progress" && job?.status === "completed";

    if (needsReason && !transitionReason) {
      toast.error("Please provide a reason for this status change");
      return;
    }

    statusTransition.mutate(
      { status: toStatus, reason: transitionReason || undefined },
      {
        onSuccess: () => {
          toast.success(`Status changed to ${STATUS_LABELS[toStatus] ?? toStatus}`);
          setTransitionReason("");
        },
        onError: () => toast.error("Failed to change status"),
      },
    );
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data: Record<string, unknown> = {};

    const name = formData.get("name") as string;
    if (name) data.name = name;

    const poNumber = formData.get("poNumber") as string;
    data.poNumber = poNumber || undefined;

    const externalNotes = formData.get("externalNotes") as string;
    data.externalNotes = externalNotes || undefined;

    const internalNotes = formData.get("internalNotes") as string;
    data.internalNotes = internalNotes || undefined;

    updateJob.mutate(data as Parameters<typeof updateJob.mutate>[0], {
      onSuccess: () => {
        toast.success("Job updated");
        setIsEditing(false);
      },
      onError: () => toast.error("Failed to update job"),
    });
  }

  function handleDelete(): void {
    if (!confirm(`Are you sure you want to delete job ${job?.jobNumber}?`)) return;
    deleteJob.mutate(id, {
      onSuccess: () => {
        toast.success("Job deleted");
        void navigate("/jobs");
      },
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
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{job.jobNumber}</h2>
            <Badge variant={STATUS_VARIANT[job.status] ?? "secondary"}>
              {STATUS_LABELS[job.status] ?? job.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{job.name}</p>
        </div>
        <div className="flex gap-2">
          {can("manage:jobs") && !isLocked ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? "Cancel Edit" : "Edit"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                Delete
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* Status Transition Controls */}
      {can("manage:jobs") && validTransitions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {validTransitions.map((status) => (
                <Button
                  key={status}
                  variant={status === "cancelled" ? "destructive" : "outline"}
                  size="sm"
                  disabled={statusTransition.isPending}
                  onClick={() => handleStatusTransition(status)}
                >
                  {STATUS_LABELS[status] ?? status}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Reason (required for some transitions)"
                value={transitionReason}
                onChange={(e) => setTransitionReason(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Job Details — Edit or View */}
      {isEditing ? (
        <form onSubmit={handleUpdate}>
          <Card>
            <CardHeader>
              <CardTitle>Edit Job</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" defaultValue={job.name} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="poNumber">PO Number</Label>
                  <Input id="poNumber" name="poNumber" defaultValue={job.poNumber ?? ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="externalNotes">External Notes</Label>
                <Textarea id="externalNotes" name="externalNotes" rows={3} defaultValue={job.externalNotes ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="internalNotes">Internal Notes</Label>
                <Textarea id="internalNotes" name="internalNotes" rows={3} defaultValue={job.internalNotes ?? ""} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateJob.isPending}>
                  {updateJob.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Job Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Job Type</dt>
                <dd className="font-medium">{job.jobTypeName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Customer</dt>
                <dd className="font-medium">{job.customerName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Project</dt>
                <dd className="font-medium">
                  {job.projectName
                    ? `${job.projectNumber} — ${job.projectName}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Priority</dt>
                <dd className="font-medium capitalize">{job.priority}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">PO Number</dt>
                <dd className="font-medium">{job.poNumber ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Min. Charge Hours</dt>
                <dd className="font-medium">{job.minimumChargeHours ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Scheduled Start</dt>
                <dd className="font-medium">{formatDate(job.scheduledStart)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Scheduled End</dt>
                <dd className="font-medium">{formatDate(job.scheduledEnd)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Actual Start</dt>
                <dd className="font-medium">{formatDate(job.actualStart)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Actual End</dt>
                <dd className="font-medium">{formatDate(job.actualEnd)}</dd>
              </div>
            </dl>
            {job.externalNotes ? (
              <div className="mt-4 rounded border p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">External Notes</p>
                <p className="text-sm whitespace-pre-wrap">{job.externalNotes}</p>
              </div>
            ) : null}
            {job.internalNotes ? (
              <div className="mt-3 rounded border p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Internal Notes</p>
                <p className="text-sm whitespace-pre-wrap">{job.internalNotes}</p>
              </div>
            ) : null}
            {job.cancellationReason ? (
              <div className="mt-3 rounded border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-medium text-destructive mb-1">Cancellation Reason</p>
                <p className="text-sm">{job.cancellationReason}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Locations */}
      {job.jobTypeVisibleSections?.locations !== false ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Locations</CardTitle>
              <CardDescription>Pickup and delivery locations</CardDescription>
            </div>
            {can("manage:jobs") && !isLocked ? (
              <AddLocationDialog jobId={id} />
            ) : null}
          </CardHeader>
          <CardContent>
            {job.locations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No locations added yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Entry Point</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Tip Fee</TableHead>
                    {can("manage:jobs") && !isLocked ? (
                      <TableHead className="w-[80px]" />
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {job.locations.map((loc) => (
                    <TableRow key={loc.id}>
                      <TableCell>
                        <Badge variant={loc.locationType === "pickup" ? "default" : "secondary"}>
                          {loc.locationType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {loc.addressStreet}, {loc.addressSuburb} {loc.addressState}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {loc.entryPointName ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {loc.contactName ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {loc.tipFee ? `$${parseFloat(loc.tipFee).toFixed(2)}` : "—"}
                      </TableCell>
                      {can("manage:jobs") && !isLocked ? (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteLocation.mutate(loc.id)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Materials */}
      {job.jobTypeVisibleSections?.materials !== false ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Materials</CardTitle>
              <CardDescription>Material snapshots for this job</CardDescription>
            </div>
            {can("manage:jobs") && !isLocked ? (
              <AddMaterialDialog jobId={id} />
            ) : null}
          </CardHeader>
          <CardContent>
            {job.materials.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No materials added yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Flow</TableHead>
                    {can("manage:jobs") && !isLocked ? (
                      <TableHead className="w-[80px]" />
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {job.materials.map((mat) => (
                    <TableRow key={mat.id}>
                      <TableCell className="font-medium">{mat.materialNameSnapshot}</TableCell>
                      <TableCell className="text-sm text-muted-foreground capitalize">
                        {mat.materialSourceType}
                      </TableCell>
                      <TableCell className="text-sm">
                        {mat.quantity ? `${mat.quantity} ${mat.unitOfMeasure ?? ""}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground capitalize">
                        {mat.flowType ?? "—"}
                      </TableCell>
                      {can("manage:jobs") && !isLocked ? (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteMaterial.mutate(mat.id)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Asset Requirements */}
      {job.jobTypeVisibleSections?.assetRequirements !== false ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Asset Requirements</CardTitle>
              <CardDescription>What assets this job needs</CardDescription>
            </div>
            {can("manage:jobs") && !isLocked ? (
              <AddAssetRequirementDialog jobId={id} />
            ) : null}
          </CardHeader>
          <CardContent>
            {job.assetRequirements.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No requirements specified.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Subcategory</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Payload Limit</TableHead>
                    <TableHead>Special Requirements</TableHead>
                    {can("manage:jobs") && !isLocked ? (
                      <TableHead className="w-[80px]" />
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {job.assetRequirements.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{req.categoryName ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {req.subcategoryName ?? "—"}
                      </TableCell>
                      <TableCell>{req.quantity}</TableCell>
                      <TableCell className="text-sm">
                        {req.payloadLimit ? `${req.payloadLimit}t` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {req.specialRequirements ?? "—"}
                      </TableCell>
                      {can("manage:jobs") && !isLocked ? (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteRequirement.mutate(req.id)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Assignments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Assignments</CardTitle>
            <CardDescription>Assets, drivers, and contractors assigned to this job</CardDescription>
          </div>
          {can("manage:jobs") && !isLocked ? (
            <AddAssignmentDialog jobId={id} assetRequirements={job.assetRequirements} />
          ) : null}
        </CardHeader>
        <CardContent>
          {job.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No resources assigned yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Planned Start</TableHead>
                  <TableHead>Planned End</TableHead>
                  {can("manage:jobs") && !isLocked ? (
                    <TableHead className="w-[160px]" />
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.assignments.map((assignment) => {
                  let resourceLabel = "—";
                  if (assignment.assignmentType === "asset") {
                    const parts: string[] = [];
                    if (assignment.assetRegistration) parts.push(assignment.assetRegistration);
                    if (assignment.assetMake || assignment.assetModel) {
                      parts.push([assignment.assetMake, assignment.assetModel].filter(Boolean).join(" "));
                    }
                    resourceLabel = parts.join(" — ") || (assignment.assetNumber ?? "—");
                  } else if (assignment.assignmentType === "driver") {
                    resourceLabel = assignment.employeeName ?? "—";
                  } else if (assignment.assignmentType === "contractor") {
                    resourceLabel = assignment.contractorName ?? "—";
                  }

                  const statusVariant =
                    assignment.status === "completed" ? "secondary" as const :
                    assignment.status === "cancelled" ? "destructive" as const :
                    assignment.status === "in_progress" ? "default" as const :
                    "outline" as const;

                  return (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {assignment.assignmentType}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{resourceLabel}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant} className="capitalize">
                          {assignment.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(assignment.plannedStart)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(assignment.plannedEnd)}
                      </TableCell>
                      {can("manage:jobs") && !isLocked ? (
                        <TableCell className="flex gap-1">
                          {assignment.status === "assigned" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateAssignment.mutate(
                                  { subId: assignment.id, data: { status: "in_progress" } },
                                  {
                                    onSuccess: () => toast.success("Assignment started"),
                                    onError: () => toast.error("Failed to update"),
                                  },
                                )
                              }
                            >
                              Start
                            </Button>
                          ) : null}
                          {assignment.status === "in_progress" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateAssignment.mutate(
                                  { subId: assignment.id, data: { status: "completed" } },
                                  {
                                    onSuccess: () => toast.success("Assignment completed"),
                                    onError: () => toast.error("Failed to update"),
                                  },
                                )
                              }
                            >
                              Complete
                            </Button>
                          ) : null}
                          {assignment.status !== "completed" && assignment.status !== "cancelled" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteAssignment.mutate(assignment.id)}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pricing Lines */}
      {job.jobTypeVisibleSections?.pricing !== false ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Pricing</CardTitle>
              <CardDescription>Revenue and cost lines</CardDescription>
            </div>
            {can("manage:pricing") && !isLocked ? (
              <AddPricingLineDialog jobId={id} />
            ) : null}
          </CardHeader>
          <CardContent>
            {job.pricingLines.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No pricing lines added yet.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      {can("manage:pricing") && !isLocked ? (
                        <TableHead className="w-[80px]" />
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {job.pricingLines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <Badge variant={line.lineType === "revenue" ? "default" : "outline"}>
                            {line.lineType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm capitalize">
                          {line.category.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {line.description ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          ${parseFloat(line.unitRate).toFixed(2)}/{line.rateType.replace("per_", "")}
                        </TableCell>
                        <TableCell className="text-sm">{line.quantity}</TableCell>
                        <TableCell className="text-right font-medium">
                          ${parseFloat(line.total).toFixed(2)}
                          {line.isLocked ? " (locked)" : ""}
                        </TableCell>
                        {can("manage:pricing") && !isLocked ? (
                          <TableCell>
                            {!line.isLocked ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => deletePricingLine.mutate(line.id)}
                              >
                                Remove
                              </Button>
                            ) : null}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Separator className="my-3" />
                <div className="flex justify-end gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Revenue: </span>
                    <span className="font-medium">
                      $
                      {job.pricingLines
                        .filter((l) => l.lineType === "revenue")
                        .reduce((sum, l) => sum + parseFloat(l.total), 0)
                        .toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cost: </span>
                    <span className="font-medium">
                      $
                      {job.pricingLines
                        .filter((l) => l.lineType === "cost")
                        .reduce((sum, l) => sum + parseFloat(l.total), 0)
                        .toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Margin: </span>
                    <span className="font-bold">
                      $
                      {(
                        job.pricingLines
                          .filter((l) => l.lineType === "revenue")
                          .reduce((sum, l) => sum + parseFloat(l.total), 0) -
                        job.pricingLines
                          .filter((l) => l.lineType === "cost")
                          .reduce((sum, l) => sum + parseFloat(l.total), 0)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Status History */}
      {job.statusHistory.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {job.statusHistory.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 text-sm">
                  <span className="text-xs text-muted-foreground w-36">
                    {formatDate(entry.createdAt)}
                  </span>
                  {entry.fromStatus ? (
                    <>
                      <Badge variant="outline" className="text-xs">
                        {STATUS_LABELS[entry.fromStatus] ?? entry.fromStatus}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                    </>
                  ) : null}
                  <Badge variant={STATUS_VARIANT[entry.toStatus] ?? "secondary"} className="text-xs">
                    {STATUS_LABELS[entry.toStatus] ?? entry.toStatus}
                  </Badge>
                  {entry.reason ? (
                    <span className="text-muted-foreground italic">"{entry.reason}"</span>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
