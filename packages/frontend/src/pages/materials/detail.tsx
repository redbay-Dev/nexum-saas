import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  useTenantMaterial,
  useSupplierMaterial,
  useCustomerMaterial,
  useDisposalMaterial,
  useUpdateTenantMaterial,
  useUpdateSupplierMaterial,
  useUpdateCustomerMaterial,
  useUpdateDisposalMaterial,
  useDeleteTenantMaterial,
  useDeleteSupplierMaterial,
  useDeleteCustomerMaterial,
  useDeleteDisposalMaterial,
} from "@frontend/api/materials.js";
import { useAuth } from "@frontend/hooks/use-auth.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Textarea } from "@frontend/components/ui/textarea.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import { toast } from "sonner";

type SourceType = "tenant" | "supplier" | "customer" | "disposal";

const UOM_LABELS: Record<string, string> = {
  tonne: "Tonne (t)",
  cubic_metre: "Cubic Metre (m\u00B3)",
  load: "Per Load",
  hour: "Per Hour",
  kilometre: "Per Kilometre",
};

export function MaterialDetailPage(): React.JSX.Element {
  const { sourceType, id } = useParams<{ sourceType: string; id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  const source = (sourceType ?? "tenant") as SourceType;

  // Fetch based on source type
  const tenantQ = useTenantMaterial(source === "tenant" ? (id ?? "") : "");
  const supplierQ = useSupplierMaterial(source === "supplier" ? (id ?? "") : "");
  const customerQ = useCustomerMaterial(source === "customer" ? (id ?? "") : "");
  const disposalQ = useDisposalMaterial(source === "disposal" ? (id ?? "") : "");

  const queryMap = { tenant: tenantQ, supplier: supplierQ, customer: customerQ, disposal: disposalQ };
  const activeQuery = queryMap[source];

  const material = activeQuery.data as Record<string, unknown> | undefined;
  const isPending = activeQuery.isPending;
  const error = activeQuery.error;

  // Update mutations
  const updateTenant = useUpdateTenantMaterial(source === "tenant" ? (id ?? "") : "");
  const updateSupplier = useUpdateSupplierMaterial(source === "supplier" ? (id ?? "") : "");
  const updateCustomer = useUpdateCustomerMaterial(source === "customer" ? (id ?? "") : "");
  const updateDisposal = useUpdateDisposalMaterial(source === "disposal" ? (id ?? "") : "");

  const deleteTenant = useDeleteTenantMaterial();
  const deleteSupplier = useDeleteSupplierMaterial();
  const deleteCustomer = useDeleteCustomerMaterial();
  const deleteDisposal = useDeleteDisposalMaterial();

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !material) {
    return (
      <div className="p-10 text-center text-destructive">
        Material not found or failed to load.
      </div>
    );
  }

  const name = material.name as string;
  const compliance = material.compliance as {
    isHazardous?: boolean;
    isDangerousGoods?: boolean;
    isRegulatedWaste?: boolean;
    requiresTracking?: boolean;
    requiresAuthority?: boolean;
    unNumber?: string;
    dgClass?: string;
    packingGroup?: string;
    wasteCode?: string;
    epaCategory?: string;
  } | null;

  function handleUpdate(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data: Record<string, unknown> = {};
    const nameVal = formData.get("name") as string;
    if (nameVal) data.name = nameVal;
    const desc = formData.get("description") as string;
    data.description = desc || null;
    const density = formData.get("densityFactor") as string;
    data.densityFactor = density ? parseFloat(density) : null;
    const notes = formData.get("notes") as string;
    data.notes = notes || null;

    // Source-specific price fields
    if (source === "supplier") {
      const pp = formData.get("purchasePrice") as string;
      data.purchasePrice = pp ? parseFloat(pp) : null;
      const code = formData.get("supplierProductCode") as string;
      data.supplierProductCode = code || null;
      const minQty = formData.get("minimumOrderQty") as string;
      data.minimumOrderQty = minQty ? parseFloat(minQty) : null;
    } else if (source === "customer") {
      const sp = formData.get("salePrice") as string;
      data.salePrice = sp ? parseFloat(sp) : null;
    } else if (source === "disposal") {
      const tf = formData.get("tipFee") as string;
      data.tipFee = tf ? parseFloat(tf) : null;
      const el = formData.get("environmentalLevy") as string;
      data.environmentalLevy = el ? parseFloat(el) : null;
      const mc = formData.get("minimumCharge") as string;
      data.minimumCharge = mc ? parseFloat(mc) : null;
      const sp = formData.get("salePrice") as string;
      data.salePrice = sp ? parseFloat(sp) : null;
    }

    const updateFn =
      source === "tenant"
        ? updateTenant
        : source === "supplier"
          ? updateSupplier
          : source === "customer"
            ? updateCustomer
            : updateDisposal;

    updateFn.mutate(data, {
      onSuccess: () => {
        toast.success("Material updated");
        setIsEditing(false);
      },
      onError: () => toast.error("Failed to update material"),
    });
  }

  function handleDelete(): void {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    const deleteFn =
      source === "tenant"
        ? deleteTenant
        : source === "supplier"
          ? deleteSupplier
          : source === "customer"
            ? deleteCustomer
            : deleteDisposal;

    deleteFn.mutate(id ?? "", {
      onSuccess: () => {
        toast.success("Material deleted");
        void navigate("/materials");
      },
      onError: () => toast.error("Failed to delete material"),
    });
  }

  const updatePending = updateTenant.isPending || updateSupplier.isPending || updateCustomer.isPending || updateDisposal.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {(material.categoryName as string) ?? ""}
            {material.subcategoryName ? ` / ${material.subcategoryName as string}` : ""}
            {" — "}
            {UOM_LABELS[material.unitOfMeasure as string] ?? (material.unitOfMeasure as string)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={(material.status as string) === "active" ? "default" : "secondary"}>
            {material.status as string}
          </Badge>
          {compliance?.isHazardous ? <Badge variant="destructive">HAZ</Badge> : null}
          {compliance?.isDangerousGoods ? <Badge variant="destructive">DG</Badge> : null}
          {can("manage:materials") ? (
            <>
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
        <form onSubmit={handleUpdate} className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" defaultValue={name} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" name="description" defaultValue={(material.description as string) ?? ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="densityFactor">Density Factor (t/m\u00B3)</Label>
                <Input id="densityFactor" name="densityFactor" type="number" step="0.0001" defaultValue={(material.densityFactor as string) ?? ""} />
              </div>
            </CardContent>
          </Card>

          {/* Source-specific pricing fields */}
          {source === "supplier" ? (
            <Card>
              <CardHeader><CardTitle>Supplier Pricing</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="purchasePrice">Purchase Price ($)</Label>
                    <Input id="purchasePrice" name="purchasePrice" type="number" step="0.01" defaultValue={(material.purchasePrice as string) ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplierProductCode">Product Code</Label>
                    <Input id="supplierProductCode" name="supplierProductCode" defaultValue={(material.supplierProductCode as string) ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minimumOrderQty">Min Order Qty</Label>
                    <Input id="minimumOrderQty" name="minimumOrderQty" type="number" step="0.01" defaultValue={(material.minimumOrderQty as string) ?? ""} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : source === "customer" ? (
            <Card>
              <CardHeader><CardTitle>Customer Pricing</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="salePrice">Sale Price ($)</Label>
                  <Input id="salePrice" name="salePrice" type="number" step="0.01" defaultValue={(material.salePrice as string) ?? ""} />
                </div>
              </CardContent>
            </Card>
          ) : source === "disposal" ? (
            <Card>
              <CardHeader><CardTitle>Disposal Pricing</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tipFee">Tip Fee ($)</Label>
                    <Input id="tipFee" name="tipFee" type="number" step="0.01" defaultValue={(material.tipFee as string) ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="environmentalLevy">Env. Levy ($)</Label>
                    <Input id="environmentalLevy" name="environmentalLevy" type="number" step="0.01" defaultValue={(material.environmentalLevy as string) ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minimumCharge">Min Charge ($)</Label>
                    <Input id="minimumCharge" name="minimumCharge" type="number" step="0.01" defaultValue={(material.minimumCharge as string) ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salePrice">Sale Price ($)</Label>
                    <Input id="salePrice" name="salePrice" type="number" step="0.01" defaultValue={(material.salePrice as string) ?? ""} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent>
              <Textarea name="notes" rows={3} defaultValue={(material.notes as string) ?? ""} />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button type="submit" disabled={updatePending}>
              {updatePending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <DetailRow label="Name" value={name} />
                <DetailRow label="Category" value={`${(material.categoryName as string) ?? "—"}${material.subcategoryName ? ` / ${material.subcategoryName as string}` : ""}`} />
                <DetailRow label="Unit of Measure" value={UOM_LABELS[material.unitOfMeasure as string] ?? (material.unitOfMeasure as string)} />
                <DetailRow label="Location" value={material.addressLabel as string | null} />
                <DetailRow label="Description" value={material.description as string | null} />
                <DetailRow label="Density Factor" value={material.densityFactor ? `${material.densityFactor as string} t/m\u00B3` : null} />
                {source === "supplier" ? (
                  <>
                    <DetailRow label="Supplier" value={material.companyName as string | null} />
                    <DetailRow label="Supplier Product Code" value={material.supplierProductCode as string | null} />
                    <DetailRow label="Purchase Price" value={material.purchasePrice ? `$${material.purchasePrice as string}` : null} />
                    <DetailRow label="Min Order Qty" value={material.minimumOrderQty as string | null} />
                  </>
                ) : source === "customer" ? (
                  <>
                    <DetailRow label="Customer" value={material.companyName as string | null} />
                    <DetailRow label="Sale Price" value={material.salePrice ? `$${material.salePrice as string}` : null} />
                  </>
                ) : source === "disposal" ? (
                  <>
                    <DetailRow label="Mode" value={(material.materialMode as string) === "disposal" ? "Disposal (accepts waste)" : "Supply (sells recycled)"} />
                    <DetailRow label="Tip Fee" value={material.tipFee ? `$${material.tipFee as string}` : null} />
                    <DetailRow label="Env. Levy" value={material.environmentalLevy ? `$${material.environmentalLevy as string}` : null} />
                    <DetailRow label="Min Charge" value={material.minimumCharge ? `$${material.minimumCharge as string}` : null} />
                    <DetailRow label="Sale Price" value={material.salePrice ? `$${material.salePrice as string}` : null} />
                  </>
                ) : null}
              </dl>
            </CardContent>
          </Card>

          {/* Compliance */}
          {compliance && (compliance.isHazardous || compliance.isDangerousGoods || compliance.isRegulatedWaste || compliance.requiresTracking) ? (
            <Card>
              <CardHeader><CardTitle>Compliance</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {compliance.isHazardous ? <DetailRow label="Hazardous" value="Yes" /> : null}
                  {compliance.isDangerousGoods ? <DetailRow label="Dangerous Goods" value="Yes" /> : null}
                  {compliance.isRegulatedWaste ? <DetailRow label="Regulated Waste" value="Yes" /> : null}
                  {compliance.requiresTracking ? <DetailRow label="Requires Tracking" value="Yes" /> : null}
                  {compliance.requiresAuthority ? <DetailRow label="Requires Authority" value="Yes" /> : null}
                  {compliance.unNumber ? <DetailRow label="UN Number" value={compliance.unNumber} /> : null}
                  {compliance.dgClass ? <DetailRow label="DG Class" value={compliance.dgClass} /> : null}
                  {compliance.packingGroup ? <DetailRow label="Packing Group" value={compliance.packingGroup} /> : null}
                  {compliance.wasteCode ? <DetailRow label="EPA Waste Code" value={compliance.wasteCode} /> : null}
                  {compliance.epaCategory ? <DetailRow label="EPA Category" value={compliance.epaCategory} /> : null}
                </dl>
              </CardContent>
            </Card>
          ) : null}

          {/* Notes */}
          {material.notes ? (
            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{material.notes as string}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

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
      <dd className="mt-0.5 text-sm">{value ?? "\u2014"}</dd>
    </div>
  );
}
