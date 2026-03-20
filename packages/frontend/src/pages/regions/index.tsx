import { useState } from "react";
import { Link } from "react-router";
import { Globe, Plus, Search } from "lucide-react";
import { useRegions, useToggleRegion } from "@frontend/api/regions.js";
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

export function RegionsPage(): React.JSX.Element {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const toggleRegion = useToggleRegion();

  const { data, isPending, error } = useRegions({
    search: search || undefined,
  });

  function handleToggle(id: string, name: string, isActive: boolean): void {
    toggleRegion.mutate(id, {
      onSuccess: () =>
        toast.success(
          `${name} ${isActive ? "deactivated" : "activated"}`,
        ),
      onError: () => toast.error("Failed to update region"),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Regions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Geographic areas for scheduling and resource allocation.
          </p>
        </div>
        {can("manage:regions") ? (
          <Button asChild>
            <Link to="/regions/new">
              <Plus className="h-4 w-4" />
              Add Region
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="px-6 py-5">
          <form className="relative w-full max-w-sm" onSubmit={(e) => e.preventDefault()}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search regions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9"
            />
          </form>
        </div>

        <div className="border-t">
          {isPending ? (
            <div className="space-y-1 p-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-10 text-center text-destructive">
              Failed to load regions. Please try again.
            </div>
          ) : data?.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
                <Globe className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">No regions yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Define geographic areas like &quot;North Metro&quot; or &quot;Western Districts&quot;.
                </p>
              </div>
              {can("manage:regions") ? (
                <Button size="sm" asChild>
                  <Link to="/regions/new">
                    <Plus className="h-4 w-4" />
                    Add Region
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region</TableHead>
                  <TableHead>Status</TableHead>
                  {can("manage:regions") ? <TableHead className="w-[150px]" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((region) => (
                  <TableRow key={region.id}>
                    <TableCell>
                      <Link
                        to={`/regions/${region.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {region.name}
                      </Link>
                      {region.description ? (
                        <p className="text-xs text-muted-foreground">
                          {region.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={region.isActive ? "default" : "secondary"}>
                        {region.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {can("manage:regions") ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/regions/${region.id}`}>Edit</Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleToggle(region.id, region.name, region.isActive)
                            }
                          >
                            {region.isActive ? "Deactivate" : "Activate"}
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
              Showing {data.data.length} of {data.total ?? data.data.length} regions
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
