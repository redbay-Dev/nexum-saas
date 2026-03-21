import { useState } from "react";
import { useNavigate } from "react-router";
import { useCreateJob } from "@frontend/api/jobs.js";
import { useJobTypes } from "@frontend/api/job-types.js";
import { useCompanies } from "@frontend/api/companies.js";
import { useProjects } from "@frontend/api/projects.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Textarea } from "@frontend/components/ui/textarea.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import { Separator } from "@frontend/components/ui/separator.js";
import { toast } from "sonner";

export function CreateJobPage(): React.JSX.Element {
  const navigate = useNavigate();
  const createJob = useCreateJob();
  const { data: jobTypesData } = useJobTypes({ isActive: true });
  const { data: customersData } = useCompanies({ role: "customer" });
  const { data: projectsData } = useProjects({ status: "active" });

  const jobTypesList = jobTypesData?.data ?? [];
  const customers = customersData?.data ?? [];
  const projectsList = projectsData?.data ?? [];

  const [jobTypeId, setJobTypeId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("medium");

  const selectedJobType = jobTypesList.find((jt) => jt.id === jobTypeId);
  const visibleSections = selectedJobType?.visibleSections;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (!jobTypeId) {
      toast.error("Please select a job type");
      return;
    }

    const name = formData.get("name") as string;
    const poNumber = (formData.get("poNumber") as string) || undefined;
    const scheduledStartStr = formData.get("scheduledStart") as string;
    const scheduledEndStr = formData.get("scheduledEnd") as string;
    const externalNotes = (formData.get("externalNotes") as string) || undefined;
    const internalNotes = (formData.get("internalNotes") as string) || undefined;
    const minimumChargeStr = formData.get("minimumChargeHours") as string;

    createJob.mutate({
      name,
      jobTypeId,
      priority,
      customerId: customerId || undefined,
      projectId: projectId || undefined,
      poNumber,
      scheduledStart: scheduledStartStr ? new Date(scheduledStartStr).toISOString() : undefined,
      scheduledEnd: scheduledEndStr ? new Date(scheduledEndStr).toISOString() : undefined,
      externalNotes,
      internalNotes,
      minimumChargeHours: minimumChargeStr ? parseFloat(minimumChargeStr) : undefined,
    }, {
      onSuccess: (result) => {
        toast.success(`Job ${result.jobNumber} created`);
        void navigate(`/jobs/${result.id}`);
      },
      onError: () => toast.error("Failed to create job"),
    });
  }

  function handleSaveDraft(e: React.FormEvent<HTMLFormElement>): void {
    handleSubmit(e);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Job</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a new job. It will be saved as a draft.
        </p>
      </div>

      <form onSubmit={handleSaveDraft} className="space-y-6">
        {/* Core Details */}
        <Card>
          <CardHeader>
            <CardTitle>Job Details</CardTitle>
            <CardDescription>Core job information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="jobTypeId">Job Type *</Label>
                <Select value={jobTypeId} onValueChange={setJobTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select job type" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobTypesList.map((jt) => (
                      <SelectItem key={jt.id} value={jt.id}>
                        {jt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Job Name *</Label>
                <Input id="name" name="name" required placeholder="e.g. Sand delivery to Southport" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customerId">Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectId">Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectsList.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.projectNumber} — {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="poNumber">PO Number</Label>
                <Input id="poNumber" name="poNumber" placeholder="Customer PO #" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minimumChargeHours">Min. Charge Hours</Label>
                <Input
                  id="minimumChargeHours"
                  name="minimumChargeHours"
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="e.g. 4"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scheduling */}
        {visibleSections?.scheduling !== false ? (
          <Card>
            <CardHeader>
              <CardTitle>Scheduling</CardTitle>
              <CardDescription>When the job is scheduled</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="scheduledStart">Scheduled Start</Label>
                  <Input
                    id="scheduledStart"
                    name="scheduledStart"
                    type="datetime-local"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduledEnd">Scheduled End</Label>
                  <Input
                    id="scheduledEnd"
                    name="scheduledEnd"
                    type="datetime-local"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>
              External notes are visible to drivers. Internal notes are for office only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="externalNotes">External Notes (visible to drivers)</Label>
              <Textarea
                id="externalNotes"
                name="externalNotes"
                rows={3}
                placeholder="Site access instructions, delivery notes..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internalNotes">Internal Notes (office only)</Label>
              <Textarea
                id="internalNotes"
                name="internalNotes"
                rows={3}
                placeholder="Pricing notes, special arrangements..."
              />
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void navigate("/jobs")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createJob.isPending}>
            {createJob.isPending ? "Creating..." : "Save Draft"}
          </Button>
        </div>
      </form>
    </div>
  );
}
