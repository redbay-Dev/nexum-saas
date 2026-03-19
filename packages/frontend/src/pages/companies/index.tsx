import { useState } from "react";
import { Link } from "react-router";
import { Building2, Plus, Search } from "lucide-react";
import { useCompanies, useDeleteCompany } from "@frontend/api/companies.js";
import type { Company } from "@frontend/api/companies.js";
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

type RoleFilter = "all" | "customer" | "contractor" | "supplier";

const ROLE_TABS: Array<{ value: RoleFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "customer", label: "Customers" },
  { value: "contractor", label: "Contractors" },
  { value: "supplier", label: "Suppliers" },
];

function getRoleBadges(company: Company): React.JSX.Element {
  return (
    <div className="flex gap-1.5">
      {company.isCustomer ? <Badge variant="default">Customer</Badge> : null}
      {company.isContractor ? <Badge variant="secondary">Contractor</Badge> : null}
      {company.isSupplier ? <Badge variant="outline">Supplier</Badge> : null}
    </div>
  );
}

export function CompaniesPage(): React.JSX.Element {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const deleteCompany = useDeleteCompany();

  const { data, isPending, error } = useCompanies({
    search: search || undefined,
    role: roleFilter === "all" ? undefined : roleFilter,
  });

  function handleDelete(id: string, name: string): void {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    deleteCompany.mutate(id, {
      onSuccess: () => toast.success(`Deleted "${name}"`),
      onError: () => toast.error("Failed to delete company"),
    });
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Companies</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your customers, contractors, and suppliers.
          </p>
        </div>
        {can("manage:companies") ? (
          <Button asChild>
            <Link to="/companies/new">
              <Plus className="h-4 w-4" />
              Add Company
            </Link>
          </Button>
        ) : null}
      </div>

      {/* Data Card */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <form className="relative w-full max-w-sm" onSubmit={(e) => e.preventDefault()}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, trading name, or ABN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9"
            />
          </form>
          <div className="flex gap-1">
            {ROLE_TABS.map((tab) => (
              <Button
                key={tab.value}
                variant={roleFilter === tab.value ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setRoleFilter(tab.value)}
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
              Failed to load companies. Please try again.
            </div>
          ) : data?.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
                <Building2 className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">No companies yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add your first customer, contractor, or supplier.
                </p>
              </div>
              {can("manage:companies") ? (
                <Button size="sm" asChild>
                  <Link to="/companies/new">
                    <Plus className="h-4 w-4" />
                    Add Company
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>ABN</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  {can("manage:companies") ? <TableHead className="w-[100px]" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <Link
                        to={`/companies/${company.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {company.name}
                      </Link>
                      {company.tradingName ? (
                        <p className="text-xs text-muted-foreground">
                          t/a {company.tradingName}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {company.abn ?? "-"}
                    </TableCell>
                    <TableCell>{getRoleBadges(company)}</TableCell>
                    <TableCell>
                      <Badge variant={company.status === "active" ? "default" : "secondary"}>
                        {company.status}
                      </Badge>
                    </TableCell>
                    {can("manage:companies") ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/companies/${company.id}`}>Edit</Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(company.id, company.name)}
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
              Showing {data.data.length} of {data.total ?? data.data.length} companies
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
