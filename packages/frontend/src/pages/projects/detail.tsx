import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useProject, useUpdateProject, useDeleteProject } from "@frontend/api/projects.js";
import { useJobs } from "@frontend/api/jobs.js";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select.js";
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

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  completed: "secondary",
  on_hold: "outline",
};

const JOB_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  quoted: "Quoted",
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  in_progress: "In Progress",
  completed: "Completed",
  invoiced: "Invoiced",
  cancelled: "Cancelled",
};

export function ProjectDetailPage(): React.JSX.Element {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: project, isPending, error } = useProject(id);
  const updateProject = useUpdateProject(id);
  const deleteProject = useDeleteProject();
  const { data: linkedJobs } = useJobs({ projectId: id });

  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState("");

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive">Project not found.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link to="/projects">Back to Projects</Link>
        </Button>
      </div>
    );
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data: Record<string, unknown> = {};

    const name = formData.get("name") as string;
    if (name) data.name = name;

    if (status) data.status = status;

    const startDate = formData.get("startDate") as string;
    data.startDate = startDate || undefined;

    const endDate = formData.get("endDate") as string;
    data.endDate = endDate || undefined;

    const notes = formData.get("notes") as string;
    data.notes = notes || undefined;

    updateProject.mutate(data as Parameters<typeof updateProject.mutate>[0], {
      onSuccess: () => {
        toast.success("Project updated");
        setIsEditing(false);
      },
      onError: () => toast.error("Failed to update project"),
    });
  }

  function handleDelete(): void {
    if (!confirm(`Delete project "${project?.name}"?`)) return;
    deleteProject.mutate(id, {
      onSuccess: () => {
        toast.success("Project deleted");
        void navigate("/projects");
      },
      onError: () => toast.error("Failed to delete project"),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{project.projectNumber}</h2>
            <Badge variant={STATUS_VARIANT[project.status] ?? "secondary"}>
              {project.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{project.name}</p>
        </div>
        <div className="flex gap-2">
          {can("manage:jobs") ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? "Cancel" : "Edit"}
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

      {isEditing ? (
        <form onSubmit={handleUpdate}>
          <Card>
            <CardHeader>
              <CardTitle>Edit Project</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={project.name} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status || project.status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" name="startDate" type="date" defaultValue={project.startDate ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" name="endDate" type="date" defaultValue={project.endDate ?? ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={3} defaultValue={project.notes ?? ""} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button type="submit" disabled={updateProject.isPending}>
                  {updateProject.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Customer</dt>
                <dd className="font-medium">{project.customerName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium capitalize">{project.status.replace(/_/g, " ")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Start Date</dt>
                <dd className="font-medium">{project.startDate ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">End Date</dt>
                <dd className="font-medium">{project.endDate ?? "—"}</dd>
              </div>
            </dl>
            {project.notes ? (
              <div className="mt-4 rounded border p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{project.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Linked Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked Jobs</CardTitle>
          <CardDescription>Jobs assigned to this project</CardDescription>
        </CardHeader>
        <CardContent>
          {!linkedJobs || linkedJobs.data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No jobs linked to this project yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Customer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linkedJobs.data.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Link
                        to={`/jobs/${job.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {job.jobNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{job.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {JOB_STATUS_LABELS[job.status] ?? job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.customerName ?? "—"}
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
