import { useState } from "react";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Textarea } from "@frontend/components/ui/textarea.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@frontend/components/ui/dialog.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select.js";
import { useAssets } from "@frontend/api/assets.js";
import { useEmployees } from "@frontend/api/employees.js";
import { useCompanies } from "@frontend/api/companies.js";
import { useCreateJobAssignment } from "@frontend/api/jobs.js";
import type { JobAssetRequirement } from "@frontend/api/jobs.js";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface AddAssignmentDialogProps {
  jobId: string;
  assetRequirements: JobAssetRequirement[];
}

export function AddAssignmentDialog({
  jobId,
  assetRequirements,
}: AddAssignmentDialogProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [assignmentType, setAssignmentType] = useState<string>("");
  const [assetId, setAssetId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [contractorCompanyId, setContractorCompanyId] = useState("");
  const [requirementId, setRequirementId] = useState("");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [notes, setNotes] = useState("");

  const { data: assetsData } = useAssets({ status: "available", limit: 100 });
  const { data: employeesData } = useEmployees({ isDriver: true, status: "active", limit: 100 });
  const { data: companiesData } = useCompanies({ role: "contractor", limit: 100 });
  const createAssignment = useCreateJobAssignment(jobId);

  const availableAssets = assetsData?.data ?? [];
  const drivers = employeesData?.data ?? [];
  const contractors = companiesData?.data ?? [];

  function resetForm(): void {
    setAssignmentType("");
    setAssetId("");
    setEmployeeId("");
    setContractorCompanyId("");
    setRequirementId("");
    setPlannedStart("");
    setPlannedEnd("");
    setNotes("");
  }

  function handleTypeChange(value: string): void {
    setAssignmentType(value);
    setAssetId("");
    setEmployeeId("");
    setContractorCompanyId("");
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();

    if (!assignmentType) {
      toast.error("Please select an assignment type");
      return;
    }

    if (assignmentType === "asset" && !assetId) {
      toast.error("Please select an asset");
      return;
    }

    if (assignmentType === "driver" && !employeeId) {
      toast.error("Please select a driver");
      return;
    }

    if (assignmentType === "contractor" && !contractorCompanyId) {
      toast.error("Please select a contractor");
      return;
    }

    const data: Record<string, unknown> = {
      assignmentType,
    };

    if (assignmentType === "asset") data.assetId = assetId;
    if (assignmentType === "driver") data.employeeId = employeeId;
    if (assignmentType === "contractor") data.contractorCompanyId = contractorCompanyId;
    if (requirementId) data.requirementId = requirementId;
    if (plannedStart) data.plannedStart = new Date(plannedStart).toISOString();
    if (plannedEnd) data.plannedEnd = new Date(plannedEnd).toISOString();
    if (notes) data.notes = notes;

    createAssignment.mutate(data, {
      onSuccess: () => {
        toast.success("Assignment added");
        resetForm();
        setOpen(false);
      },
      onError: () => toast.error("Failed to add assignment"),
    });
  }

  function getAssetLabel(asset: (typeof availableAssets)[number]): string {
    const parts: string[] = [];
    if (asset.registrationNumber) parts.push(asset.registrationNumber);
    if (asset.make || asset.model) parts.push([asset.make, asset.model].filter(Boolean).join(" "));
    if (asset.assetNumber) parts.push(`(${asset.assetNumber})`);
    return parts.join(" — ") || asset.id;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Assignment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Assign Resource</DialogTitle>
            <DialogDescription>
              Assign a specific asset, driver, or contractor to this job.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Assignment Type</Label>
              <Select value={assignmentType} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">Asset</SelectItem>
                  <SelectItem value="driver">Driver</SelectItem>
                  <SelectItem value="contractor">Contractor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {assignmentType === "asset" ? (
              <div className="grid gap-2">
                <Label>Asset</Label>
                <Select value={assetId} onValueChange={setAssetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAssets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {getAssetLabel(asset)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {assignmentType === "driver" ? (
              <div className="grid gap-2">
                <Label>Driver</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {assignmentType === "contractor" ? (
              <div className="grid gap-2">
                <Label>Contractor</Label>
                <Select value={contractorCompanyId} onValueChange={setContractorCompanyId}>
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

            {assetRequirements.length > 0 ? (
              <div className="grid gap-2">
                <Label>Fulfils Requirement (optional)</Label>
                <Select value={requirementId} onValueChange={setRequirementId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Link to a requirement" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetRequirements.map((req) => (
                      <SelectItem key={req.id} value={req.id}>
                        {req.categoryName ?? "Unknown"} × {req.quantity}
                        {req.subcategoryName ? ` (${req.subcategoryName})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Planned Start</Label>
                <Input
                  type="datetime-local"
                  value={plannedStart}
                  onChange={(e) => setPlannedStart(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Planned End</Label>
                <Input
                  type="datetime-local"
                  value={plannedEnd}
                  onChange={(e) => setPlannedEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes for this assignment"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createAssignment.isPending}>
              {createAssignment.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
