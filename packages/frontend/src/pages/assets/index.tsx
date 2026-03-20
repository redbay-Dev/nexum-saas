import { useState } from "react";
import { Link } from "react-router";
import { Plus, Search, Truck } from "lucide-react";
import { useAssets, useDeleteAsset } from "@frontend/api/assets.js";
import { useAssetCategories } from "@frontend/api/asset-categories.js";
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

type StatusFilter = "all" | "available" | "in_use" | "maintenance" | "grounded" | "retired";
type OwnershipFilter = "all" | "tenant" | "contractor";

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "in_use", label: "In Use" },
  { value: "maintenance", label: "Maintenance" },
  { value: "grounded", label: "Grounded" },
  { value: "retired", label: "Retired" },
];

const OWNERSHIP_TABS: Array<{ value: OwnershipFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "tenant", label: "Own Fleet" },
  { value: "contractor", label: "Contractor" },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  available: "default",
  in_use: "secondary",
  maintenance: "outline",
  inspection: "outline",
  repairs: "outline",
  grounded: "destructive",
  retired: "secondary",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  in_use: "In Use",
  maintenance: "Maintenance",
  inspection: "Inspection",
  repairs: "Repairs",
  grounded: "Grounded",
  retired: "Retired",
};

export function AssetsPage(): React.JSX.Element {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const deleteAsset = useDeleteAsset();

  const { data: categoriesData } = useAssetCategories();
  const categories = categoriesData?.data ?? [];

  const { data, isPending, error } = useAssets({
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    ownership: ownershipFilter === "all" ? undefined : ownershipFilter,
    categoryId: categoryFilter === "all" ? undefined : categoryFilter,
  });

  function handleDelete(id: string, label: string): void {
    if (!confirm(`Are you sure you want to delete "${label}"?`)) return;
    deleteAsset.mutate(id, {
      onSuccess: () => toast.success(`Deleted "${label}"`),
      onError: () => toast.error("Failed to delete asset"),
    });
  }

  function getAssetLabel(asset: {
    assetNumber: string | null;
    registrationNumber: string | null;
    make: string | null;
    model: string | null;
  }): string {
    if (asset.registrationNumber) return asset.registrationNumber;
    if (asset.assetNumber) return asset.assetNumber;
    return [asset.make, asset.model].filter(Boolean).join(" ") || "Unnamed";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Assets &amp; Fleet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage trucks, trailers, equipment, and tools.
          </p>
        </div>
        {can("manage:assets") ? (
          <Button asChild>
            <Link to="/assets/new">
              <Plus className="h-4 w-4" />
              Add Asset
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
              placeholder="Search rego, make, model, VIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9"
            />
          </form>
          <div className="flex flex-wrap gap-3">
            {categories.length > 0 ? (
              <div className="flex gap-1">
                <Button
                  variant={categoryFilter === "all" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setCategoryFilter("all")}
                >
                  All Types
                </Button>
                {categories.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={categoryFilter === cat.id ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setCategoryFilter(cat.id)}
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
            ) : null}
            <div className="flex gap-1">
              {OWNERSHIP_TABS.map((tab) => (
                <Button
                  key={tab.value}
                  variant={ownershipFilter === tab.value ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setOwnershipFilter(tab.value)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t px-6 py-2">
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
              Failed to load assets. Please try again.
            </div>
          ) : data?.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
                <Truck className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">No assets yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add your first truck, trailer, or piece of equipment.
                </p>
              </div>
              {can("manage:assets") ? (
                <Button size="sm" asChild>
                  <Link to="/assets/new">
                    <Plus className="h-4 w-4" />
                    Add Asset
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Make / Model</TableHead>
                  <TableHead>Ownership</TableHead>
                  <TableHead>Status</TableHead>
                  {can("manage:assets") ? (
                    <TableHead className="w-[100px]" />
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <Link
                        to={`/assets/${asset.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {getAssetLabel(asset)}
                      </Link>
                      {asset.assetNumber && asset.registrationNumber ? (
                        <p className="text-xs text-muted-foreground">
                          #{asset.assetNumber}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {asset.categoryName ?? "—"}
                      {asset.subcategoryName ? (
                        <span className="text-muted-foreground">
                          {" / "}
                          {asset.subcategoryName}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[asset.make, asset.model, asset.year]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </TableCell>
                    <TableCell>
                      {asset.ownership === "contractor" ? (
                        <Badge variant="outline">
                          {asset.contractorName ?? "Contractor"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Own Fleet</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[asset.status] ?? "secondary"}>
                        {STATUS_LABELS[asset.status] ?? asset.status}
                      </Badge>
                    </TableCell>
                    {can("manage:assets") ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/assets/${asset.id}`}>Edit</Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                              handleDelete(asset.id, getAssetLabel(asset))
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
              Showing {data.data.length} of {data.total ?? data.data.length} assets
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
