import { useState } from "react";
import { Link } from "react-router";
import { Plus, Search, Users } from "lucide-react";
import { useEmployees, useDeleteEmployee } from "@frontend/api/employees.js";
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

type TypeFilter = "all" | "drivers" | "employees";
type StatusFilter = "all" | "active" | "on_leave" | "suspended" | "terminated";

const TYPE_TABS: Array<{ value: TypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "drivers", label: "Drivers" },
  { value: "employees", label: "Non-Drivers" },
];

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On Leave" },
  { value: "suspended", label: "Suspended" },
  { value: "terminated", label: "Terminated" },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  on_leave: "outline",
  suspended: "secondary",
  terminated: "destructive",
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  casual: "Casual",
  salary: "Salary",
  wages: "Wages",
};

export function EmployeesPage(): React.JSX.Element {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const deleteEmployee = useDeleteEmployee();

  const { data, isPending, error } = useEmployees({
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    isDriver: typeFilter === "all" ? undefined : typeFilter === "drivers",
  });

  function handleDelete(id: string, name: string): void {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    deleteEmployee.mutate(id, {
      onSuccess: () => toast.success(`Deleted "${name}"`),
      onError: () => toast.error("Failed to delete employee"),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Drivers &amp; Employees
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your workforce — drivers, yard staff, mechanics, and admin.
          </p>
        </div>
        {can("manage:drivers") ? (
          <Button asChild>
            <Link to="/employees/new">
              <Plus className="h-4 w-4" />
              Add Employee
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
              placeholder="Search by name, email, position..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9"
            />
          </form>
          <div className="flex gap-3">
            <div className="flex gap-1">
              {TYPE_TABS.map((tab) => (
                <Button
                  key={tab.value}
                  variant={typeFilter === tab.value ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setTypeFilter(tab.value)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-1">
              {STATUS_TABS.map((tab) => (
                <Button
                  key={tab.value}
                  variant={
                    statusFilter === tab.value ? "secondary" : "ghost"
                  }
                  size="sm"
                  onClick={() => setStatusFilter(tab.value)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
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
              Failed to load employees. Please try again.
            </div>
          ) : data?.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
                <Users className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">No employees yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add your first employee or driver.
                </p>
              </div>
              {can("manage:drivers") ? (
                <Button size="sm" asChild>
                  <Link to="/employees/new">
                    <Plus className="h-4 w-4" />
                    Add Employee
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  {can("manage:drivers") ? (
                    <TableHead className="w-[100px]" />
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <Link
                        to={`/employees/${emp.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {emp.firstName} {emp.lastName}
                      </Link>
                      {emp.email ? (
                        <p className="text-xs text-muted-foreground">
                          {emp.email}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {emp.position}
                    </TableCell>
                    <TableCell className="text-sm">
                      {EMPLOYMENT_LABELS[emp.employmentType] ??
                        emp.employmentType}
                    </TableCell>
                    <TableCell>
                      {emp.isDriver ? (
                        <Badge variant="outline">Driver</Badge>
                      ) : (
                        <Badge variant="secondary">Employee</Badge>
                      )}
                      {emp.contractorCompanyId ? (
                        <Badge
                          variant="outline"
                          className="ml-1"
                        >
                          Contractor
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          STATUS_VARIANT[emp.status] ?? "secondary"
                        }
                      >
                        {emp.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    {can("manage:drivers") ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/employees/${emp.id}`}>
                              Edit
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                              handleDelete(
                                emp.id,
                                `${emp.firstName} ${emp.lastName}`,
                              )
                            }
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
              Showing {data.data.length} of{" "}
              {data.total ?? data.data.length} employees
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
