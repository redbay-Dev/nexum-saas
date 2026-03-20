import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useCreateRegion } from "@frontend/api/regions.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Textarea } from "@frontend/components/ui/textarea.js";
import { toast } from "sonner";

export function CreateRegionPage(): React.JSX.Element {
  const navigate = useNavigate();
  const createRegion = useCreateRegion();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    createRegion.mutate(
      {
        name,
        description: description || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Created "${name}"`);
          void navigate("/regions");
        },
        onError: () => toast.error("Failed to create region"),
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/regions">
            <ArrowLeft className="h-4 w-4" />
            Back to regions
          </Link>
        </Button>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-8 py-6">
          <h2 className="text-lg font-semibold">Add Region</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Define a geographic area for scheduling and resource allocation.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-8 py-6">
            <div className="space-y-2">
              <Label htmlFor="name">Region name</Label>
              <Input
                id="name"
                className="h-11"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. North Metro, Geelong Corridor, Western Districts"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the geographic area covered by this region..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t px-8 py-5">
            <Button variant="outline" asChild>
              <Link to="/regions">Cancel</Link>
            </Button>
            <Button type="submit" disabled={createRegion.isPending}>
              {createRegion.isPending ? "Creating..." : "Create Region"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
