import { useState } from "react";
import { Link } from "react-router";
import { MapPin, Plus, Search } from "lucide-react";
import { useAddresses, useDeleteAddress } from "@frontend/api/addresses.js";
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

const TYPE_LABELS: Record<string, string> = {
  office: "Office",
  job_site: "Job Site",
  quarry: "Quarry",
  depot: "Depot",
  disposal_site: "Disposal",
  storage: "Storage",
};

export function AddressesPage(): React.JSX.Element {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const deleteAddress = useDeleteAddress();

  const { data, isPending, error } = useAddresses({
    search: search || undefined,
  });

  function handleDelete(id: string, label: string): void {
    if (!confirm(`Are you sure you want to delete "${label}"?`)) return;
    deleteAddress.mutate(id, {
      onSuccess: () => toast.success(`Deleted "${label}"`),
      onError: () => toast.error("Failed to delete address"),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Addresses</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sites, depots, quarries, and offices across your operations.
          </p>
        </div>
        {can("manage:addresses") ? (
          <Button asChild>
            <Link to="/addresses/new">
              <Plus className="h-4 w-4" />
              Add Address
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="px-6 py-5">
          <form className="relative w-full max-w-sm" onSubmit={(e) => e.preventDefault()}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by street, suburb, or postcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9"
            />
          </form>
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
              Failed to load addresses. Please try again.
            </div>
          ) : data?.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
                <MapPin className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">No addresses yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add your first site, depot, or office location.
                </p>
              </div>
              {can("manage:addresses") ? (
                <Button size="sm" asChild>
                  <Link to="/addresses/new">
                    <Plus className="h-4 w-4" />
                    Add Address
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Types</TableHead>
                  {can("manage:addresses") ? <TableHead className="w-[100px]" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((address) => (
                  <TableRow key={address.id}>
                    <TableCell>
                      <Link
                        to={`/addresses/${address.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {address.streetAddress}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {address.suburb} {address.state} {address.postcode}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{address.state}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {address.types.map((type) => (
                          <Badge key={type} variant="secondary" className="text-[10px]">
                            {TYPE_LABELS[type] ?? type}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    {can("manage:addresses") ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/addresses/${address.id}`}>Edit</Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                              handleDelete(address.id, address.streetAddress)
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
              Showing {data.data.length} of {data.total ?? data.data.length} addresses
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
