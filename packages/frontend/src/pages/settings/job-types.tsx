import { useState } from "react";
import { useAuth } from "@frontend/hooks/use-auth.js";
import {
  useJobTypes,
  useCreateJobType,
  useUpdateJobType,
  useDeleteJobType,
} from "@frontend/api/job-types.js";
import type { JobType, JobTypeVisibleSections, JobTypeRequiredFields } from "@frontend/api/job-types.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Textarea } from "@frontend/components/ui/textarea.js";
import { Badge } from "@frontend/components/ui/badge.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@frontend/components/ui/dialog.js";
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
import { Plus, Pencil, Trash2 } from "lucide-react";

const SECTION_LABELS: Record<keyof JobTypeVisibleSections, string> = {
  locations: "Locations",
  materials: "Materials",
  assetRequirements: "Asset Requirements",
  pricing: "Pricing",
  scheduling: "Scheduling",
};

const REQUIRED_FIELD_LABELS: Record<keyof JobTypeRequiredFields, string> = {
  poNumber: "PO Number",
  materials: "Materials",
  locations: "Locations",
};

function CheckboxField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): React.JSX.Element {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-input"
      />
      {label}
    </label>
  );
}

interface JobTypeFormState {
  name: string;
  code: string;
  description: string;
  visibleSections: JobTypeVisibleSections;
  requiredFields: JobTypeRequiredFields;
  isActive: boolean;
}

const DEFAULT_FORM: JobTypeFormState = {
  name: "",
  code: "",
  description: "",
  visibleSections: {
    locations: true,
    materials: true,
    assetRequirements: true,
    pricing: true,
    scheduling: true,
  },
  requiredFields: {
    poNumber: false,
    materials: false,
    locations: false,
  },
  isActive: true,
};

function formFromJobType(jt: JobType): JobTypeFormState {
  return {
    name: jt.name,
    code: jt.code,
    description: jt.description ?? "",
    visibleSections: {
      locations: jt.visibleSections?.locations ?? true,
      materials: jt.visibleSections?.materials ?? true,
      assetRequirements: jt.visibleSections?.assetRequirements ?? true,
      pricing: jt.visibleSections?.pricing ?? true,
      scheduling: jt.visibleSections?.scheduling ?? true,
    },
    requiredFields: {
      poNumber: jt.requiredFields?.poNumber ?? false,
      materials: jt.requiredFields?.materials ?? false,
      locations: jt.requiredFields?.locations ?? false,
    },
    isActive: jt.isActive,
  };
}

function JobTypeFormDialog({
  editingType,
  onClose,
}: {
  editingType: JobType | null;
  onClose: () => void;
}): React.JSX.Element {
  const isEdit = editingType !== null;
  const [form, setForm] = useState<JobTypeFormState>(
    isEdit ? formFromJobType(editingType) : { ...DEFAULT_FORM },
  );

  const createJobType = useCreateJobType();
  const updateJobType = useUpdateJobType(editingType?.id ?? "");

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();

    if (!form.name || !form.code) {
      toast.error("Name and code are required");
      return;
    }

    const data = {
      name: form.name,
      code: form.code,
      description: form.description || undefined,
      visibleSections: form.visibleSections,
      requiredFields: form.requiredFields,
      isActive: form.isActive,
    };

    if (isEdit) {
      updateJobType.mutate(data, {
        onSuccess: () => {
          toast.success("Job type updated");
          onClose();
        },
        onError: () => toast.error("Failed to update job type"),
      });
    } else {
      createJobType.mutate(data, {
        onSuccess: () => {
          toast.success("Job type created");
          onClose();
        },
        onError: () => toast.error("Failed to create job type"),
      });
    }
  }

  const isPending = createJobType.isPending || updateJobType.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit Job Type" : "Create Job Type"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Update the job type configuration."
            : "Define a new job type that controls form behaviour and visible sections."}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Transport"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="e.g. TRANSPORT"
              disabled={isEdit && editingType.isSystem}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            placeholder="Optional description"
          />
        </div>
        <div className="grid gap-2">
          <Label>Visible Sections</Label>
          <div className="flex flex-wrap gap-4">
            {(Object.keys(SECTION_LABELS) as Array<keyof JobTypeVisibleSections>).map((key) => (
              <CheckboxField
                key={key}
                id={`vs-${key}`}
                label={SECTION_LABELS[key]}
                checked={form.visibleSections[key]}
                onChange={(checked) =>
                  setForm({
                    ...form,
                    visibleSections: { ...form.visibleSections, [key]: checked },
                  })
                }
              />
            ))}
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Required Fields</Label>
          <div className="flex flex-wrap gap-4">
            {(Object.keys(REQUIRED_FIELD_LABELS) as Array<keyof JobTypeRequiredFields>).map((key) => (
              <CheckboxField
                key={key}
                id={`rf-${key}`}
                label={REQUIRED_FIELD_LABELS[key]}
                checked={form.requiredFields[key]}
                onChange={(checked) =>
                  setForm({
                    ...form,
                    requiredFields: { ...form.requiredFields, [key]: checked },
                  })
                }
              />
            ))}
          </div>
        </div>
        <CheckboxField
          id="isActive"
          label="Active"
          checked={form.isActive}
          onChange={(checked) => setForm({ ...form, isActive: checked })}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : isEdit ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function JobTypeSettingsPage(): React.JSX.Element {
  const { can } = useAuth();
  const { data: jobTypesData, isPending } = useJobTypes({ limit: 100 });
  const deleteJobType = useDeleteJobType();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<JobType | null>(null);

  const jobTypes = jobTypesData?.data ?? [];
  const canManage = can("manage:jobs");

  function handleEdit(jt: JobType): void {
    setEditingType(jt);
    setDialogOpen(true);
  }

  function handleCreate(): void {
    setEditingType(null);
    setDialogOpen(true);
  }

  function handleDelete(jt: JobType): void {
    if (jt.isSystem) {
      toast.error("System job types cannot be deleted");
      return;
    }
    if (!confirm(`Delete job type "${jt.name}"?`)) return;
    deleteJobType.mutate(jt.id, {
      onSuccess: () => toast.success("Job type deleted"),
      onError: () => toast.error("Failed to delete job type"),
    });
  }

  function handleDialogClose(): void {
    setDialogOpen(false);
    setEditingType(null);
  }

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Job Types</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure job types that control form behaviour, visible sections, and required fields.
          </p>
        </div>
        {canManage ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreate}>
                <Plus className="mr-1.5 h-4 w-4" />
                New Job Type
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px]">
              <JobTypeFormDialog editingType={editingType} onClose={handleDialogClose} />
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Job Types</CardTitle>
          <CardDescription>
            System types (Transport, Disposal, Hire, On-site) are seeded by default and cannot be deleted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Visible Sections</TableHead>
                <TableHead>Required Fields</TableHead>
                <TableHead>Status</TableHead>
                {canManage ? <TableHead className="w-[100px]" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 6 : 5} className="py-8 text-center text-muted-foreground">
                    No job types found.
                  </TableCell>
                </TableRow>
              ) : (
                jobTypes.map((jt) => (
                  <TableRow key={jt.id}>
                    <TableCell className="font-medium">
                      {jt.name}
                      {jt.isSystem ? (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          System
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {jt.code}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {jt.visibleSections
                          ? (Object.entries(jt.visibleSections) as Array<[keyof JobTypeVisibleSections, boolean]>)
                              .filter(([, v]) => v)
                              .map(([k]) => (
                                <Badge key={k} variant="secondary" className="text-[10px]">
                                  {SECTION_LABELS[k]}
                                </Badge>
                              ))
                          : <span className="text-xs text-muted-foreground">All</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {jt.requiredFields
                          ? (Object.entries(jt.requiredFields) as Array<[keyof JobTypeRequiredFields, boolean]>)
                              .filter(([, v]) => v)
                              .map(([k]) => (
                                <Badge key={k} variant="secondary" className="text-[10px]">
                                  {REQUIRED_FIELD_LABELS[k]}
                                </Badge>
                              ))
                          : <span className="text-xs text-muted-foreground">None</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={jt.isActive ? "default" : "outline"}>
                        {jt.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(jt)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {!jt.isSystem ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(jt)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
