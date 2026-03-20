import { useState } from "react";
import { Link } from "react-router";
import { Package, Plus, Search } from "lucide-react";
import {
  useTenantMaterials,
  useSupplierMaterials,
  useCustomerMaterials,
  useDisposalMaterials,
  useDeleteTenantMaterial,
  useDeleteSupplierMaterial,
  useDeleteCustomerMaterial,
  useDeleteDisposalMaterial,
  type SupplierMaterial,
  type CustomerMaterial,
  type DisposalMaterial,
} from "@frontend/api/materials.js";
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

type SourceTab = "tenant" | "supplier" | "customer" | "disposal";

const SOURCE_TABS: Array<{ value: SourceTab; label: string }> = [
  { value: "tenant", label: "Own Stock" },
  { value: "supplier", label: "Supplier" },
  { value: "customer", label: "Customer" },
  { value: "disposal", label: "Disposal" },
];

const UOM_LABELS: Record<string, string> = {
  tonne: "t",
  cubic_metre: "m\u00B3",
  load: "load",
  hour: "hr",
  kilometre: "km",
};

const MODE_LABELS: Record<string, string> = {
  disposal: "Accept",
  supply: "Supply",
};

export function MaterialsPage(): React.JSX.Element {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [sourceTab, setSourceTab] = useState<SourceTab>("tenant");

  const deleteTenant = useDeleteTenantMaterial();
  const deleteSupplier = useDeleteSupplierMaterial();
  const deleteCustomer = useDeleteCustomerMaterial();
  const deleteDisposal = useDeleteDisposalMaterial();

  const searchParam = search || undefined;
  const tenantQ = useTenantMaterials({ search: searchParam });
  const supplierQ = useSupplierMaterials({ search: searchParam });
  const customerQ = useCustomerMaterials({ search: searchParam });
  const disposalQ = useDisposalMaterials({ search: searchParam });

  const queryMap = {
    tenant: tenantQ,
    supplier: supplierQ,
    customer: customerQ,
    disposal: disposalQ,
  };

  const activeQuery = queryMap[sourceTab];
  const items = activeQuery.data?.data ?? [];
  const isPending = activeQuery.isPending;
  const error = activeQuery.error;

  function handleDelete(id: string, name: string): void {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    const deleteFn =
      sourceTab === "tenant"
        ? deleteTenant
        : sourceTab === "supplier"
          ? deleteSupplier
          : sourceTab === "customer"
            ? deleteCustomer
            : deleteDisposal;

    deleteFn.mutate(id, {
      onSuccess: () => toast.success(`Deleted "${name}"`),
      onError: () => toast.error("Failed to delete material"),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Materials</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage materials across your own stock, suppliers, customers, and disposal sites.
          </p>
        </div>
        {can("manage:materials") ? (
          <Button asChild>
            <Link to="/materials/new">
              <Plus className="h-4 w-4" />
              Add Material
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
              placeholder="Search materials..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9"
            />
          </form>
        </div>

        <div className="border-t px-6 py-2">
          <div className="flex gap-1">
            {SOURCE_TABS.map((tab) => (
              <Button
                key={tab.value}
                variant={sourceTab === tab.value ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSourceTab(tab.value)}
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
              Failed to load materials. Please try again.
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
                <Package className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">No materials yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add your first material to start tracking.
                </p>
              </div>
              {can("manage:materials") ? (
                <Button size="sm" asChild>
                  <Link to="/materials/new">
                    <Plus className="h-4 w-4" />
                    Add Material
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Category</TableHead>
                  {sourceTab === "supplier" ? (
                    <TableHead>Supplier</TableHead>
                  ) : sourceTab === "customer" ? (
                    <TableHead>Customer</TableHead>
                  ) : sourceTab === "disposal" ? (
                    <TableHead>Mode</TableHead>
                  ) : null}
                  <TableHead>Unit</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  {can("manage:materials") ? (
                    <TableHead className="w-[100px]" />
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const id = item.id;
                  const name = item.name;
                  const categoryName = item.categoryName;
                  const subcategoryName = item.subcategoryName;
                  const unitOfMeasure = item.unitOfMeasure;
                  const addressLabel = item.addressLabel;
                  const status = item.status;
                  const companyName = "companyName" in item ? (item as SupplierMaterial | CustomerMaterial).companyName : null;
                  const materialMode = "materialMode" in item ? (item as DisposalMaterial).materialMode : undefined;
                  const compliance = item.compliance;

                  return (
                    <TableRow key={id}>
                      <TableCell>
                        <Link
                          to={`/materials/${sourceTab}/${id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {name}
                        </Link>
                        {compliance?.isHazardous ? (
                          <Badge variant="destructive" className="ml-2 text-[10px]">HAZ</Badge>
                        ) : null}
                        {compliance?.isDangerousGoods ? (
                          <Badge variant="destructive" className="ml-1 text-[10px]">DG</Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        {categoryName ?? "—"}
                        {subcategoryName ? (
                          <span className="text-muted-foreground">
                            {" / "}
                            {subcategoryName}
                          </span>
                        ) : null}
                      </TableCell>
                      {sourceTab === "supplier" ? (
                        <TableCell className="text-sm">{companyName ?? "—"}</TableCell>
                      ) : sourceTab === "customer" ? (
                        <TableCell className="text-sm">{companyName ?? "—"}</TableCell>
                      ) : sourceTab === "disposal" ? (
                        <TableCell>
                          <Badge variant={materialMode === "disposal" ? "outline" : "secondary"}>
                            {MODE_LABELS[materialMode ?? ""] ?? materialMode}
                          </Badge>
                        </TableCell>
                      ) : null}
                      <TableCell className="text-sm">
                        {UOM_LABELS[unitOfMeasure] ?? unitOfMeasure}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {addressLabel ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status === "active" ? "default" : "secondary"}>
                          {status}
                        </Badge>
                      </TableCell>
                      {can("manage:materials") ? (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/materials/${sourceTab}/${id}`}>
                                Edit
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(id, name)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {items.length > 0 ? (
          <div className="border-t px-6 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {items.length} materials
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
