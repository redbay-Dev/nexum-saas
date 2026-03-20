import { useState } from "react";
import { useNavigate } from "react-router";
import { useCreateAsset } from "@frontend/api/assets.js";
import {
  useAssetCategories,
  type AssetCategory,
} from "@frontend/api/asset-categories.js";
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

const AUSTRALIAN_STATES = ["QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT"];

export function CreateAssetPage(): React.JSX.Element {
  const navigate = useNavigate();
  const createAsset = useCreateAsset();
  const { data: categoriesData } = useAssetCategories();
  const { data: companiesData } = useCompanies({ role: "contractor" });

  const categories = categoriesData?.data ?? [];
  const contractors = companiesData?.data ?? [];

  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [ownership, setOwnership] = useState("tenant");
  const [contractorCompanyId, setContractorCompanyId] = useState("");

  // Get selected category for feature toggles
  const selectedCategory: AssetCategory | undefined = categories.find(
    (c) => c.id === categoryId,
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data: Record<string, unknown> = {
      categoryId,
      ownership,
    };

    if (subcategoryId) data.subcategoryId = subcategoryId;
    if (ownership === "contractor" && contractorCompanyId) {
      data.contractorCompanyId = contractorCompanyId;
    }

    // Core fields
    const assetNumber = formData.get("assetNumber") as string;
    if (assetNumber) data.assetNumber = assetNumber;

    // Registration
    if (selectedCategory?.enableRegistration) {
      const rego = formData.get("registrationNumber") as string;
      if (rego) data.registrationNumber = rego;
      const regoState = formData.get("registrationState") as string;
      if (regoState) data.registrationState = regoState;
      const regoExpiry = formData.get("registrationExpiry") as string;
      if (regoExpiry) data.registrationExpiry = regoExpiry;
    }

    // Make/model
    const make = formData.get("make") as string;
    if (make) data.make = make;
    const model = formData.get("model") as string;
    if (model) data.model = model;
    const yearStr = formData.get("year") as string;
    if (yearStr) data.year = parseInt(yearStr, 10);
    const vin = formData.get("vin") as string;
    if (vin) data.vin = vin;

    // Weight specs
    if (selectedCategory?.enableWeightSpecs) {
      const tare = formData.get("tareWeight") as string;
      if (tare) data.tareWeight = parseFloat(tare);
      const gvmVal = formData.get("gvm") as string;
      if (gvmVal) data.gvm = parseFloat(gvmVal);
      const gcmVal = formData.get("gcm") as string;
      if (gcmVal) data.gcm = parseFloat(gcmVal);
    }

    // Body
    if (selectedCategory?.enableSpecifications) {
      const bodyMaterial = formData.get("bodyMaterial") as string;
      if (bodyMaterial) data.bodyMaterial = bodyMaterial;
      const bodyType = formData.get("bodyType") as string;
      if (bodyType) data.bodyType = bodyType;
      const sideHeightStr = formData.get("sideHeight") as string;
      if (sideHeightStr) data.sideHeight = parseFloat(sideHeightStr);
    }

    // Capacity
    if (selectedCategory?.enableCapacityFields) {
      const cap = formData.get("capacity") as string;
      if (cap) data.capacity = parseFloat(cap);
      const capUnit = formData.get("capacityUnit") as string;
      if (capUnit) data.capacityUnit = capUnit;
    }

    // Engine hours
    if (selectedCategory?.enableEngineHours) {
      const eh = formData.get("engineHours") as string;
      if (eh) data.engineHours = parseFloat(eh);
    }

    // Odometer
    const odo = formData.get("odometer") as string;
    if (odo) data.odometer = parseFloat(odo);

    // Notes
    const notes = formData.get("notes") as string;
    if (notes) data.notes = notes;

    createAsset.mutate(data as unknown as Parameters<typeof createAsset.mutate>[0], {
      onSuccess: (asset) => {
        toast.success("Asset created");
        void navigate(`/assets/${asset.id}`);
      },
      onError: () => toast.error("Failed to create asset"),
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Add Asset</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Register a new truck, trailer, or piece of equipment.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Category & Ownership */}
        <Card>
          <CardHeader>
            <CardTitle>Classification</CardTitle>
            <CardDescription>
              Select the asset category and ownership type.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={categoryId} onValueChange={(v) => {
                  setCategoryId(v);
                  setSubcategoryId("");
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCategory && selectedCategory.subcategories.length > 0 ? (
                <div className="space-y-2">
                  <Label>Subcategory</Label>
                  <Select value={subcategoryId} onValueChange={setSubcategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedCategory.subcategories
                        .filter((s) => s.isActive)
                        .map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Ownership</Label>
                <Select value={ownership} onValueChange={setOwnership}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tenant">Own Fleet</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {ownership === "contractor" ? (
                <div className="space-y-2">
                  <Label>Contractor Company *</Label>
                  <Select
                    value={contractorCompanyId}
                    onValueChange={setContractorCompanyId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select contractor" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractors.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="assetNumber">Asset Number</Label>
              <Input
                id="assetNumber"
                name="assetNumber"
                placeholder="Auto-generated if left blank"
              />
            </div>
          </CardContent>
        </Card>

        {/* Registration (if enabled) */}
        {selectedCategory?.enableRegistration ? (
          <Card>
            <CardHeader>
              <CardTitle>Registration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="registrationNumber">Rego Number</Label>
                  <Input
                    id="registrationNumber"
                    name="registrationNumber"
                    placeholder="e.g. ABC123"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registrationState">State</Label>
                  <Select name="registrationState">
                    <SelectTrigger>
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent>
                      {AUSTRALIAN_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registrationExpiry">Expiry</Label>
                  <Input
                    id="registrationExpiry"
                    name="registrationExpiry"
                    type="date"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Make / Model / VIN */}
        <Card>
          <CardHeader>
            <CardTitle>Identification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="make">Make</Label>
                <Input id="make" name="make" placeholder="e.g. Kenworth" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input id="model" name="model" placeholder="e.g. T909" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input id="year" name="year" type="number" placeholder="e.g. 2024" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vin">VIN / Serial Number</Label>
                <Input id="vin" name="vin" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weight Specs (if enabled) */}
        {selectedCategory?.enableWeightSpecs ? (
          <Card>
            <CardHeader>
              <CardTitle>Weight Specifications</CardTitle>
              <CardDescription>All weights in kilograms (kg).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="tareWeight">Tare Weight (kg)</Label>
                  <Input
                    id="tareWeight"
                    name="tareWeight"
                    type="number"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gvm">GVM (kg)</Label>
                  <Input id="gvm" name="gvm" type="number" step="0.01" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gcm">GCM (kg)</Label>
                  <Input id="gcm" name="gcm" type="number" step="0.01" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Specifications (if enabled) */}
        {selectedCategory?.enableSpecifications ? (
          <Card>
            <CardHeader>
              <CardTitle>Body Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="bodyType">Body Type</Label>
                  <Input
                    id="bodyType"
                    name="bodyType"
                    placeholder="e.g. Tipper"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bodyMaterial">Body Material</Label>
                  <Input
                    id="bodyMaterial"
                    name="bodyMaterial"
                    placeholder="e.g. Steel"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sideHeight">Side Height (m)</Label>
                  <Input
                    id="sideHeight"
                    name="sideHeight"
                    type="number"
                    step="0.01"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Capacity (if enabled) */}
        {selectedCategory?.enableCapacityFields ? (
          <Card>
            <CardHeader>
              <CardTitle>Capacity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacity</Label>
                  <Input
                    id="capacity"
                    name="capacity"
                    type="number"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacityUnit">Unit</Label>
                  <Input
                    id="capacityUnit"
                    name="capacityUnit"
                    placeholder="e.g. m³, litres, tonnes"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Engine Hours (if enabled) + Odometer */}
        {selectedCategory?.enableEngineHours || selectedCategory ? (
          <Card>
            <CardHeader>
              <CardTitle>Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {selectedCategory?.enableEngineHours ? (
                  <div className="space-y-2">
                    <Label htmlFor="engineHours">Engine Hours</Label>
                    <Input
                      id="engineHours"
                      name="engineHours"
                      type="number"
                      step="0.1"
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="odometer">Odometer (km)</Label>
                  <Input
                    id="odometer"
                    name="odometer"
                    type="number"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              name="notes"
              placeholder="Any additional notes about this asset..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void navigate("/assets")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!categoryId || createAsset.isPending}>
            {createAsset.isPending ? "Creating..." : "Create Asset"}
          </Button>
        </div>
      </form>
    </div>
  );
}
