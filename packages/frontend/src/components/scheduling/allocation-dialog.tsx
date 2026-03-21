import { useState, useMemo } from "react";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Textarea } from "@frontend/components/ui/textarea.js";
import { Badge } from "@frontend/components/ui/badge.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@frontend/components/ui/dialog.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select.js";
import {
  useSchedulingResources,
  useSchedulingConflicts,
} from "@frontend/api/scheduling.js";
import type { SchedulingJobAssignment } from "@frontend/api/scheduling.js";
import { useCreateJobAssignment } from "@frontend/api/jobs.js";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Truck, User, Building2 } from "lucide-react";
import { useCompanies } from "@frontend/api/companies.js";

interface SchedulerAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobNumber: string;
  jobName: string;
  date: string;
  existingAssignments: SchedulingJobAssignment[];
}

export function SchedulerAllocationDialog({
  open,
  onOpenChange,
  jobId,
  jobNumber,
  jobName,
  date,
  existingAssignments,
}: SchedulerAllocationDialogProps): React.JSX.Element {
  const [assignmentType, setAssignmentType] = useState<string>("asset");
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [plannedStart, setPlannedStart] = useState(`${date}T06:00`);
  const [plannedEnd, setPlannedEnd] = useState("");
  const [notes, setNotes] = useState("");

  const queryClient = useQueryClient();
  const createAssignment = useCreateJobAssignment(jobId);

  // Load resources for the date
  const { data: resourcesData } = useSchedulingResources(date);
  const { data: conflictsData } = useSchedulingConflicts(date);
  const { data: companiesData } = useCompanies({ role: "contractor", limit: 100 });

  const availableAssets = resourcesData?.assets ?? [];
  const availableDrivers = resourcesData?.drivers ?? [];
  const contractors = companiesData?.data ?? [];
  const conflicts = useMemo(() => conflictsData?.conflicts ?? [], [conflictsData?.conflicts]);

  // IDs already assigned to this job
  const alreadyAssignedAssetIds = useMemo(
    () => new Set(existingAssignments.filter((a) => a.assetId).map((a) => a.assetId)),
    [existingAssignments],
  );
  const alreadyAssignedDriverIds = useMemo(
    () => new Set(existingAssignments.filter((a) => a.employeeId).map((a) => a.employeeId)),
    [existingAssignments],
  );

  // Check if selected resource has a conflict
  const selectedConflict = useMemo(() => {
    if (!selectedResourceId) return null;
    const resourceType = assignmentType === "asset" ? "asset" : assignmentType === "driver" ? "driver" : null;
    if (!resourceType) return null;
    return conflicts.find(
      (c) => c.resourceType === resourceType && c.resourceId === selectedResourceId,
    ) ?? null;
  }, [selectedResourceId, assignmentType, conflicts]);

  function resetForm(): void {
    setAssignmentType("asset");
    setSelectedResourceId("");
    setPlannedStart(`${date}T06:00`);
    setPlannedEnd("");
    setNotes("");
  }

  function handleTypeChange(value: string): void {
    setAssignmentType(value);
    setSelectedResourceId("");
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();

    if (!selectedResourceId) {
      toast.error("Please select a resource");
      return;
    }

    const data: Record<string, unknown> = {
      assignmentType,
    };

    if (assignmentType === "asset") data.assetId = selectedResourceId;
    if (assignmentType === "driver") data.employeeId = selectedResourceId;
    if (assignmentType === "contractor") data.contractorCompanyId = selectedResourceId;
    if (plannedStart) data.plannedStart = new Date(plannedStart).toISOString();
    if (plannedEnd) data.plannedEnd = new Date(plannedEnd).toISOString();
    if (notes) data.notes = notes;

    createAssignment.mutate(data, {
      onSuccess: () => {
        toast.success(`${assignmentType === "asset" ? "Asset" : assignmentType === "driver" ? "Driver" : "Contractor"} allocated to ${jobNumber}`);
        resetForm();
        onOpenChange(false);
        // Invalidate scheduling queries to refresh the view
        void queryClient.invalidateQueries({ queryKey: ["scheduling"] });
      },
      onError: () => toast.error("Failed to allocate resource"),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[540px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Allocate Resource</DialogTitle>
            <DialogDescription>
              Allocate a resource to <span className="font-medium">{jobNumber}</span> — {jobName}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Resource type tabs */}
            <div className="grid gap-2">
              <Label>Resource Type</Label>
              <div className="flex gap-1">
                {[
                  { value: "asset", label: "Asset", icon: Truck },
                  { value: "driver", label: "Driver", icon: User },
                  { value: "contractor", label: "Contractor", icon: Building2 },
                ].map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    type="button"
                    variant={assignmentType === value ? "secondary" : "ghost"}
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => handleTypeChange(value)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Resource selector */}
            {assignmentType === "asset" ? (
              <div className="grid gap-2">
                <Label>Asset</Label>
                <Select value={selectedResourceId} onValueChange={setSelectedResourceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAssets.map((asset) => {
                      const isAlready = alreadyAssignedAssetIds.has(asset.id);
                      const label = [asset.registrationNumber, asset.make, asset.model]
                        .filter(Boolean)
                        .join(" ") || asset.fleetNumber || asset.id;

                      return (
                        <SelectItem key={asset.id} value={asset.id} disabled={isAlready}>
                          <div className="flex items-center gap-2">
                            <span>{label}</span>
                            {asset.categoryName ? (
                              <span className="text-xs text-muted-foreground">
                                {asset.categoryName}{asset.subcategoryName ? ` / ${asset.subcategoryName}` : ""}
                              </span>
                            ) : null}
                            {asset.allocationCount > 0 ? (
                              <Badge variant="outline" className="ml-auto text-xs">
                                {asset.allocationCount} job{asset.allocationCount !== 1 ? "s" : ""}
                              </Badge>
                            ) : null}
                            {isAlready ? (
                              <Badge variant="secondary" className="ml-auto text-xs">
                                Already assigned
                              </Badge>
                            ) : null}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {assignmentType === "driver" ? (
              <div className="grid gap-2">
                <Label>Driver</Label>
                <Select value={selectedResourceId} onValueChange={setSelectedResourceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDrivers.map((driver) => {
                      const isAlready = alreadyAssignedDriverIds.has(driver.id);
                      return (
                        <SelectItem key={driver.id} value={driver.id} disabled={isAlready}>
                          <div className="flex items-center gap-2">
                            <span>{driver.firstName} {driver.lastName}</span>
                            {driver.allocationCount > 0 ? (
                              <Badge variant="outline" className="ml-auto text-xs">
                                {driver.allocationCount} job{driver.allocationCount !== 1 ? "s" : ""}
                              </Badge>
                            ) : null}
                            {isAlready ? (
                              <Badge variant="secondary" className="ml-auto text-xs">
                                Already assigned
                              </Badge>
                            ) : null}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {assignmentType === "contractor" ? (
              <div className="grid gap-2">
                <Label>Contractor</Label>
                <Select value={selectedResourceId} onValueChange={setSelectedResourceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select contractor" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractors.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {/* Conflict warning */}
            {selectedConflict ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">Double-booking warning</p>
                  <p className="mt-1 text-muted-foreground">
                    <span className="font-medium">{selectedConflict.resourceLabel}</span> is already
                    allocated to {selectedConflict.jobs.length} job{selectedConflict.jobs.length !== 1 ? "s" : ""} today:{" "}
                    {selectedConflict.jobs.map((j) => j.jobNumber).join(", ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    You can still allocate — this is a warning, not a block.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Times */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Arrival Time</Label>
                <Input
                  type="datetime-local"
                  value={plannedStart}
                  onChange={(e) => setPlannedStart(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>End Time (optional)</Label>
                <Input
                  type="datetime-local"
                  value={plannedEnd}
                  onChange={(e) => setPlannedEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Staggered arrival, special instructions..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createAssignment.isPending || !selectedResourceId}
            >
              {createAssignment.isPending ? "Allocating..." : "Allocate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
