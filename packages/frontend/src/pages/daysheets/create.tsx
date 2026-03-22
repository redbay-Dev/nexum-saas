import { useState } from "react";
import { useNavigate } from "react-router";
import { useCreateDaysheet } from "@frontend/api/daysheets.js";
import { useJobs } from "@frontend/api/jobs.js";
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
import { toast } from "sonner";

export function CreateDaysheetPage(): React.JSX.Element {
  const navigate = useNavigate();
  const createDaysheet = useCreateDaysheet();
  const { data: jobsData } = useJobs({ status: "in_progress", limit: 100 });

  const [form, setForm] = useState({
    jobId: "",
    workDate: new Date().toISOString().split("T")[0] ?? "",
    submissionChannel: "staff_entry",
    // Hourly
    startTime: "",
    endTime: "",
    breakMinutes: "",
    // Notes
    notes: "",
    internalNotes: "",
  });

  function updateForm(field: string, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    if (!form.jobId) {
      toast.error("Please select a job");
      return;
    }

    try {
      const result = await createDaysheet.mutateAsync({
        jobId: form.jobId,
        workDate: form.workDate,
        submissionChannel: form.submissionChannel,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        breakMinutes: form.breakMinutes ? parseInt(form.breakMinutes, 10) : undefined,
        notes: form.notes || undefined,
        internalNotes: form.internalNotes || undefined,
      });
      toast.success("Daysheet created");
      void navigate(`/daysheets/${result.id}`);
    } catch {
      toast.error("Failed to create daysheet");
    }
  }

  const jobs = jobsData?.data ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">New Daysheet</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Record work performed on a job
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Job Details</CardTitle>
            <CardDescription>Which job was this work performed on?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jobId">Job</Label>
              <Select value={form.jobId} onValueChange={(v) => updateForm("jobId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a job" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.jobNumber} — {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workDate">Work Date</Label>
                <Input
                  id="workDate"
                  type="date"
                  value={form.workDate}
                  onChange={(e) => updateForm("workDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="submissionChannel">Submission Channel</Label>
                <Select value={form.submissionChannel} onValueChange={(v) => updateForm("submissionChannel", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff_entry">Staff Entry</SelectItem>
                    <SelectItem value="portal">Portal Upload</SelectItem>
                    <SelectItem value="driverx">DriverX App</SelectItem>
                    <SelectItem value="auto_generated">Auto-Generated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Time (Hourly Work)</CardTitle>
            <CardDescription>For hourly-rated jobs, enter start and end times</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => updateForm("startTime", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => updateForm("endTime", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="breakMinutes">Break (minutes)</Label>
                <Input
                  id="breakMinutes"
                  type="number"
                  min="0"
                  value={form.breakMinutes}
                  onChange={(e) => updateForm("breakMinutes", e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Driver / External Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => updateForm("notes", e.target.value)}
                placeholder="Observations, delays, issues..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internalNotes">Internal Notes</Label>
              <Textarea
                id="internalNotes"
                value={form.internalNotes}
                onChange={(e) => updateForm("internalNotes", e.target.value)}
                placeholder="Staff-only notes..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => void navigate("/daysheets")}>
            Cancel
          </Button>
          <Button type="submit" disabled={createDaysheet.isPending}>
            Create Daysheet
          </Button>
        </div>
      </form>
    </div>
  );
}
