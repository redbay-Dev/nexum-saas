import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  useAsset,
  useUpdateAsset,
  useUpdateAssetStatus,
  useDeleteAsset,
  useCreatePairing,
  useDeletePairing,
} from "@frontend/api/assets.js";
import { useAssets } from "@frontend/api/assets.js";
import { useAuth } from "@frontend/hooks/use-auth.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Textarea } from "@frontend/components/ui/textarea.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
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

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@frontend/components/ui/dialog.js";
import { toast } from "sonner";
import { Link2, Plus, Trash2 } from "lucide-react";

const AUSTRALIAN_STATES = ["QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT"];

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "in_use", label: "In Use" },
  { value: "maintenance", label: "Maintenance" },
  { value: "inspection", label: "Inspection" },
  { value: "repairs", label: "Repairs" },
  { value: "grounded", label: "Grounded" },
  { value: "retired", label: "Retired" },
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

export function AssetDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: asset, isPending, error } = useAsset(id ?? "");
  const updateAsset = useUpdateAsset(id ?? "");
  const updateStatus = useUpdateAssetStatus(id ?? "");
  const deleteAsset = useDeleteAsset();
  const [isEditing, setIsEditing] = useState(false);
  const [pairingDialogOpen, setPairingDialogOpen] = useState(false);

  const toggles = asset?.categoryToggles;

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="p-10 text-center text-destructive">
        Asset not found or failed to load.
      </div>
    );
  }

  const assetLabel =
    asset.registrationNumber ??
    asset.assetNumber ??
    [asset.make, asset.model].filter(Boolean).join(" ") ??
    "Asset";

  function handleUpdate(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data: Record<string, unknown> = {};

    // Registration
    const rego = formData.get("registrationNumber") as string;
    data.registrationNumber = rego || null;
    const regoState = formData.get("registrationState") as string;
    data.registrationState = regoState || null;
    const regoExpiry = formData.get("registrationExpiry") as string;
    data.registrationExpiry = regoExpiry || null;

    // Make/model
    const make = formData.get("make") as string;
    data.make = make || null;
    const model = formData.get("model") as string;
    data.model = model || null;
    const yearStr = formData.get("year") as string;
    data.year = yearStr ? parseInt(yearStr, 10) : null;
    const vin = formData.get("vin") as string;
    data.vin = vin || null;

    // Weight specs
    if (toggles?.enableWeightSpecs) {
      const tare = formData.get("tareWeight") as string;
      data.tareWeight = tare ? parseFloat(tare) : null;
      const gvmVal = formData.get("gvm") as string;
      data.gvm = gvmVal ? parseFloat(gvmVal) : null;
      const gcmVal = formData.get("gcm") as string;
      data.gcm = gcmVal ? parseFloat(gcmVal) : null;
    }

    // Body
    if (toggles?.enableSpecifications) {
      const bodyType = formData.get("bodyType") as string;
      data.bodyType = bodyType || null;
      const bodyMaterial = formData.get("bodyMaterial") as string;
      data.bodyMaterial = bodyMaterial || null;
      const sideHeight = formData.get("sideHeight") as string;
      data.sideHeight = sideHeight ? parseFloat(sideHeight) : null;
    }

    // Capacity
    if (toggles?.enableCapacityFields) {
      const cap = formData.get("capacity") as string;
      data.capacity = cap ? parseFloat(cap) : null;
      const capUnit = formData.get("capacityUnit") as string;
      data.capacityUnit = capUnit || null;
    }

    // Engine hours / odometer
    if (toggles?.enableEngineHours) {
      const eh = formData.get("engineHours") as string;
      data.engineHours = eh ? parseFloat(eh) : null;
    }
    const odo = formData.get("odometer") as string;
    data.odometer = odo ? parseFloat(odo) : null;

    const notes = formData.get("notes") as string;
    data.notes = notes || null;

    updateAsset.mutate(data as Parameters<typeof updateAsset.mutate>[0], {
      onSuccess: () => {
        toast.success("Asset updated");
        setIsEditing(false);
      },
      onError: () => toast.error("Failed to update asset"),
    });
  }

  function handleStatusChange(newStatus: string): void {
    updateStatus.mutate(
      { status: newStatus },
      {
        onSuccess: () => toast.success(`Status changed to ${newStatus.replace("_", " ")}`),
        onError: () => toast.error("Failed to update status"),
      },
    );
  }

  function handleDelete(): void {
    if (!confirm(`Are you sure you want to delete "${assetLabel}"?`)) return;
    deleteAsset.mutate(id ?? "", {
      onSuccess: () => {
        toast.success("Asset deleted");
        void navigate("/assets");
      },
      onError: () => toast.error("Failed to delete asset"),
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{assetLabel}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {asset.categoryName}
            {asset.subcategoryName ? ` / ${asset.subcategoryName}` : ""}
            {asset.assetNumber ? ` — #${asset.assetNumber}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[asset.status] ?? "secondary"}>
            {asset.status.replace("_", " ")}
          </Badge>
          {can("manage:assets") ? (
            <>
              <Select
                value={asset.status}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={isEditing ? "default" : "outline"}
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? "Cancel Edit" : "Edit"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                Delete
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {isEditing ? (
        /* ── Edit Form ── */
        <form onSubmit={handleUpdate} className="space-y-6">
          {/* Registration */}
          {toggles?.enableRegistration ? (
            <Card>
              <CardHeader>
                <CardTitle>Registration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="registrationNumber">Rego</Label>
                    <Input
                      id="registrationNumber"
                      name="registrationNumber"
                      defaultValue={asset.registrationNumber ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <select
                      name="registrationState"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      defaultValue={asset.registrationState ?? ""}
                    >
                      <option value="">—</option>
                      {AUSTRALIAN_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registrationExpiry">Expiry</Label>
                    <Input
                      id="registrationExpiry"
                      name="registrationExpiry"
                      type="date"
                      defaultValue={asset.registrationExpiry ?? ""}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Make/Model */}
          <Card>
            <CardHeader>
              <CardTitle>Identification</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="make">Make</Label>
                  <Input id="make" name="make" defaultValue={asset.make ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" name="model" defaultValue={asset.model ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input id="year" name="year" type="number" defaultValue={asset.year ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vin">VIN</Label>
                  <Input id="vin" name="vin" defaultValue={asset.vin ?? ""} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weight Specs */}
          {toggles?.enableWeightSpecs ? (
            <Card>
              <CardHeader>
                <CardTitle>Weight Specifications (kg)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="tareWeight">Tare</Label>
                    <Input id="tareWeight" name="tareWeight" type="number" step="0.01" defaultValue={asset.tareWeight ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gvm">GVM</Label>
                    <Input id="gvm" name="gvm" type="number" step="0.01" defaultValue={asset.gvm ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gcm">GCM</Label>
                    <Input id="gcm" name="gcm" type="number" step="0.01" defaultValue={asset.gcm ?? ""} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Body Configuration */}
          {toggles?.enableSpecifications ? (
            <Card>
              <CardHeader>
                <CardTitle>Body Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="bodyType">Body Type</Label>
                    <Input id="bodyType" name="bodyType" defaultValue={asset.bodyType ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bodyMaterial">Material</Label>
                    <Input id="bodyMaterial" name="bodyMaterial" defaultValue={asset.bodyMaterial ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sideHeight">Side Height (m)</Label>
                    <Input id="sideHeight" name="sideHeight" type="number" step="0.01" defaultValue={asset.sideHeight ?? ""} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Capacity */}
          {toggles?.enableCapacityFields ? (
            <Card>
              <CardHeader>
                <CardTitle>Capacity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Capacity</Label>
                    <Input id="capacity" name="capacity" type="number" step="0.01" defaultValue={asset.capacity ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacityUnit">Unit</Label>
                    <Input id="capacityUnit" name="capacityUnit" defaultValue={asset.capacityUnit ?? ""} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Tracking */}
          <Card>
            <CardHeader>
              <CardTitle>Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {toggles?.enableEngineHours ? (
                  <div className="space-y-2">
                    <Label htmlFor="engineHours">Engine Hours</Label>
                    <Input id="engineHours" name="engineHours" type="number" step="0.1" defaultValue={asset.engineHours ?? ""} />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="odometer">Odometer (km)</Label>
                  <Input id="odometer" name="odometer" type="number" defaultValue={asset.odometer ?? ""} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea name="notes" rows={3} defaultValue={asset.notes ?? ""} />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateAsset.isPending}>
              {updateAsset.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      ) : (
        /* ── Read-Only View ── */
        <div className="space-y-6">
          {/* Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <DetailRow label="Asset Number" value={asset.assetNumber} />
                <DetailRow label="Category" value={`${asset.categoryName ?? ""}${asset.subcategoryName ? ` / ${asset.subcategoryName}` : ""}`} />
                <DetailRow label="Ownership" value={asset.ownership === "contractor" ? `Contractor — ${asset.contractorName ?? ""}` : "Own Fleet"} />
                {toggles?.enableRegistration ? (
                  <>
                    <DetailRow label="Registration" value={asset.registrationNumber} />
                    <DetailRow label="Rego State" value={asset.registrationState} />
                    <DetailRow label="Rego Expiry" value={asset.registrationExpiry} />
                  </>
                ) : null}
                <DetailRow label="Make" value={asset.make} />
                <DetailRow label="Model" value={asset.model} />
                <DetailRow label="Year" value={asset.year?.toString()} />
                <DetailRow label="VIN" value={asset.vin} />
              </dl>
            </CardContent>
          </Card>

          {/* Weight Specs */}
          {toggles?.enableWeightSpecs ? (
            <Card>
              <CardHeader>
                <CardTitle>Weight Specifications</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                  <DetailRow label="Tare Weight" value={asset.tareWeight ? `${asset.tareWeight} kg` : null} />
                  <DetailRow label="GVM" value={asset.gvm ? `${asset.gvm} kg` : null} />
                  <DetailRow label="GCM" value={asset.gcm ? `${asset.gcm} kg` : null} />
                </dl>
                {asset.tareWeight && asset.gvm ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Payload capacity: {(parseFloat(asset.gvm) - parseFloat(asset.tareWeight)).toLocaleString()} kg
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {/* Body Configuration */}
          {toggles?.enableSpecifications && (asset.bodyType || asset.bodyMaterial || asset.sideHeight) ? (
            <Card>
              <CardHeader>
                <CardTitle>Body Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                  <DetailRow label="Body Type" value={asset.bodyType} />
                  <DetailRow label="Material" value={asset.bodyMaterial} />
                  <DetailRow label="Side Height" value={asset.sideHeight ? `${asset.sideHeight} m` : null} />
                </dl>
              </CardContent>
            </Card>
          ) : null}

          {/* Capacity */}
          {toggles?.enableCapacityFields && (asset.capacity || asset.capacityUnit) ? (
            <Card>
              <CardHeader>
                <CardTitle>Capacity</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailRow label="Capacity" value={asset.capacity ? `${asset.capacity} ${asset.capacityUnit ?? ""}`.trim() : null} />
              </CardContent>
            </Card>
          ) : null}

          {/* Tracking */}
          {(asset.engineHours || asset.odometer) ? (
            <Card>
              <CardHeader>
                <CardTitle>Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {toggles?.enableEngineHours ? (
                    <DetailRow label="Engine Hours" value={asset.engineHours} />
                  ) : null}
                  <DetailRow label="Odometer" value={asset.odometer ? `${parseFloat(asset.odometer).toLocaleString()} km` : null} />
                </dl>
              </CardContent>
            </Card>
          ) : null}

          {/* Default Pairings */}
          {(asset.categoryType === "truck" || asset.categoryType === "trailer") ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Default Pairings</CardTitle>
                    <CardDescription>
                      {asset.categoryType === "truck"
                        ? "Trailers that are commonly paired with this truck."
                        : "Trucks that commonly use this trailer."}
                    </CardDescription>
                  </div>
                  {can("manage:assets") && asset.categoryType === "truck" ? (
                    <PairingDialog
                      truckId={asset.id}
                      open={pairingDialogOpen}
                      onOpenChange={setPairingDialogOpen}
                    />
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                {asset.categoryType === "truck" ? (
                  <PairingsList
                    pairings={asset.defaultPairings.asTruck}
                    type="trailer"
                    assetId={asset.id}
                    canManage={can("manage:assets")}
                  />
                ) : (
                  <PairingsList
                    pairings={asset.defaultPairings.asTrailer}
                    type="truck"
                    assetId={asset.id}
                    canManage={can("manage:assets")}
                  />
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* Notes */}
          {asset.notes ? (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{asset.notes}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Helper Components ──

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}): React.JSX.Element {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value ?? "—"}</dd>
    </div>
  );
}

function PairingsList({
  pairings,
  type,
  assetId,
  canManage,
}: {
  pairings: Array<{
    id: string;
    trailerId?: string;
    trailerAssetNumber?: string | null;
    trailerRegistration?: string | null;
    trailerMake?: string | null;
    trailerModel?: string | null;
    truckId?: string;
    truckAssetNumber?: string | null;
    truckRegistration?: string | null;
    truckMake?: string | null;
    truckModel?: string | null;
    notes: string | null;
  }>;
  type: "truck" | "trailer";
  assetId: string;
  canManage: boolean;
}): React.JSX.Element {
  const deletePairing = useDeletePairing(assetId);

  if (pairings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No default pairings configured.</p>
    );
  }

  return (
    <div className="space-y-2">
      {pairings.map((p) => {
        const label =
          type === "trailer"
            ? p.trailerRegistration ?? p.trailerAssetNumber ?? [p.trailerMake, p.trailerModel].filter(Boolean).join(" ")
            : p.truckRegistration ?? p.truckAssetNumber ?? [p.truckMake, p.truckModel].filter(Boolean).join(" ");

        return (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-md border px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{label}</span>
              {p.notes ? (
                <span className="text-xs text-muted-foreground">
                  — {p.notes}
                </span>
              ) : null}
            </div>
            {canManage ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  deletePairing.mutate(p.id, {
                    onSuccess: () => toast.success("Pairing removed"),
                    onError: () => toast.error("Failed to remove pairing"),
                  });
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function PairingDialog({
  truckId,
  open,
  onOpenChange,
}: {
  truckId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const createPairing = useCreatePairing(truckId);

  // Fetch trailers for selection
  const { data: trailersData } = useAssets({ status: "available" });
  const trailers =
    trailersData?.data.filter((a) => a.categoryType === "trailer") ?? [];

  const [trailerId, setTrailerId] = useState("");

  function handleAdd(): void {
    if (!trailerId) return;
    createPairing.mutate(
      { trailerId },
      {
        onSuccess: () => {
          toast.success("Pairing added");
          setTrailerId("");
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to add pairing"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" />
          Add Pairing
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Default Trailer Pairing</DialogTitle>
          <DialogDescription>
            Select a trailer to pair with this truck as the default combination.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Trailer</Label>
            <Select value={trailerId} onValueChange={setTrailerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select trailer" />
              </SelectTrigger>
              <SelectContent>
                {trailers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.registrationNumber ?? t.assetNumber ?? (`${t.make ?? ""} ${t.model ?? ""}`.trim() || "Unnamed")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!trailerId || createPairing.isPending}>
              {createPairing.isPending ? "Adding..." : "Add Pairing"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
