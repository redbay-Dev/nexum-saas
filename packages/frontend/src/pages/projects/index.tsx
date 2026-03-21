import { useState } from "react";
import { Link } from "react-router";
import { FolderKanban, Plus, Search } from "lucide-react";
import { useProjects, useDeleteProject } from "@frontend/api/projects.js";
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

type StatusFilter = "all" | "active" | "completed" | "on_hold";

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On Hold" },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  completed: "secondary",
  on_hold: "outline",
};

export function ProjectsPage(): React.JSX.Element {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const deleteProject = useDeleteProject();

  const { data, isPending, error } = useProjects({
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  function handleDelete(id: string, label: string): void {
    if (!confirm(`Are you sure you want to delete "${label}"?`)) return;
    deleteProject.mutate(id, {
      onSuccess: () => toast.success(`Deleted "${label}"`),
      onError: () => toast.error("Failed to delete project"),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Projects</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Group related jobs into projects.
          </p>
        </div>
        {can("manage:jobs") ? (
          <Button asChild>
            <Link to="/projects/new">
              <Plus className="h-4 w-4" />
              New Project
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
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9"
            />
          </form>
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

        <div className="border-t">
          {isPending ? (
            <div className="space-y-1 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-10 text-center text-destructive">
              Failed to load projects.
            </div>
          ) : data?.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
                <FolderKanban className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">No projects yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a project to group related jobs together.
                </p>
              </div>
              {can("manage:jobs") ? (
                <Button size="sm" asChild>
                  <Link to="/projects/new">
                    <Plus className="h-4 w-4" />
                    New Project
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  {can("manage:jobs") ? (
                    <TableHead className="w-[100px]" />
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Link
                        to={`/projects/${project.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {project.projectNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{project.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.customerName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[project.status] ?? "secondary"}>
                        {project.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.startDate ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.endDate ?? "—"}
                    </TableCell>
                    {can("manage:jobs") ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/projects/${project.id}`}>View</Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(project.id, project.name)}
                          >
                            Delete
                          </Button>
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
              Showing {data.data.length} of {data.total ?? data.data.length} projects
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
