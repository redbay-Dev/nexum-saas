import { useState } from "react";
import { useNavigate } from "react-router";
import { useCreateProject } from "@frontend/api/projects.js";
import { useCompanies } from "@frontend/api/companies.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Textarea } from "@frontend/components/ui/textarea.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import { Separator } from "@frontend/components/ui/separator.js";
import { toast } from "sonner";

export function CreateProjectPage(): React.JSX.Element {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const { data: customersData } = useCompanies({ role: "customer" });

  const customers = customersData?.data ?? [];

  const [customerId, setCustomerId] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const name = formData.get("name") as string;
    const startDate = (formData.get("startDate") as string) || undefined;
    const endDate = (formData.get("endDate") as string) || undefined;
    const notes = (formData.get("notes") as string) || undefined;

    createProject.mutate({
      name,
      customerId: customerId || undefined,
      startDate,
      endDate,
      notes,
    }, {
      onSuccess: (result) => {
        toast.success(`Project ${result.projectNumber} created`);
        void navigate(`/projects/${result.id}`);
      },
      onError: () => toast.error("Failed to create project"),
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Project</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a project to group related jobs.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>Basic project information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input id="name" name="name" required placeholder="e.g. Southport Development Stage 2" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerId">Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input id="startDate" name="startDate" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input id="endDate" name="endDate" type="date" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} placeholder="Project description or notes..." />
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void navigate("/projects")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createProject.isPending}>
            {createProject.isPending ? "Creating..." : "Create Project"}
          </Button>
        </div>
      </form>
    </div>
  );
}
