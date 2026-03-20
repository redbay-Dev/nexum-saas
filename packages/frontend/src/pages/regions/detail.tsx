import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useRegion, useUpdateRegion, useToggleRegion } from "@frontend/api/regions.js";
import { useAuth } from "@frontend/hooks/use-auth.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Textarea } from "@frontend/components/ui/textarea.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { toast } from "sonner";

export function RegionDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { data: region, isPending, error } = useRegion(id ?? "");
  const updateRegion = useUpdateRegion(id ?? "");
  const toggleRegion = useToggleRegion();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (region) {
      setName(region.name);
      setDescription(region.description ?? "");
    }
  }, [region]);

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    updateRegion.mutate(
      {
        name,
        description: description || undefined,
      },
      {
        onSuccess: () => toast.success("Region updated"),
        onError: () => toast.error("Failed to update region"),
      },
    );
  }

  function handleToggle(): void {
    if (!region) return;
    toggleRegion.mutate(region.id, {
      onSuccess: () =>
        toast.success(
          `${region.name} ${region.isActive ? "deactivated" : "activated"}`,
        ),
      onError: () => toast.error("Failed to update region"),
    });
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </div>
    );
  }

  if (error || !region) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          Region not found.{" "}
          <Link to="/regions" className="underline">
            Back to regions
          </Link>
        </div>
      </div>
    );
  }

  const canEdit = can("manage:regions");

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/regions">
            <ArrowLeft className="h-4 w-4" />
            Back to regions
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant={region.isActive ? "default" : "secondary"}>
            {region.isActive ? "Active" : "Inactive"}
          </Badge>
          <Badge variant="outline">{region.addressCount} addresses</Badge>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-8 py-6">
          <h2 className="text-lg font-semibold">{region.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Created {new Date(region.createdAt).toLocaleDateString("en-AU")}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-8 py-6">
            <div className="space-y-2">
              <Label htmlFor="name">Region name</Label>
              <Input id="name" className="h-11" value={name} onChange={(e) => setName(e.target.value)} required disabled={!canEdit} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} disabled={!canEdit} />
            </div>
          </div>

          {canEdit ? (
            <div className="flex justify-between border-t px-8 py-5">
              <Button type="button" variant="outline" onClick={handleToggle}>
                {region.isActive ? "Deactivate" : "Activate"}
              </Button>
              <Button type="submit" disabled={updateRegion.isPending}>
                {updateRegion.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
