import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  useCreateTenantMaterial,
  useCreateSupplierMaterial,
  useCreateCustomerMaterial,
  useCreateDisposalMaterial,
} from "@frontend/api/materials.js";
import { useMaterialCategories } from "@frontend/api/material-categories.js";
import { useCompanies } from "@frontend/api/companies.js";
import { useAddresses } from "@frontend/api/addresses.js";
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

type SourceType = "tenant" | "supplier" | "customer" | "disposal";

const UOM_OPTIONS = [
  { value: "tonne", label: "Tonne (t)" },
  { value: "cubic_metre", label: "Cubic Metre (m\u00B3)" },
  { value: "load", label: "Per Load" },
  { value: "hour", label: "Per Hour" },
  { value: "kilometre", label: "Per Kilometre" },
];

export function CreateMaterialPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSource = (searchParams.get("source") as SourceType) || "tenant";

  const [sourceType, setSourceType] = useState<SourceType>(initialSource);
  const [subcategoryId, setSubcategoryId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [unitOfMeasure, setUnitOfMeasure] = useState("");
  const [materialMode, setMaterialMode] = useState("disposal");

  const { data: categoriesData } = useMaterialCategories();
  const categories = categoriesData?.data ?? [];

  const { data: suppliersData } = useCompanies({ role: "supplier" });
  const suppliers = suppliersData?.data ?? [];

  const { data: customersData } = useCompanies({ role: "customer" });
  const customers = customersData?.data ?? [];

  const { data: addressesData } = useAddresses();
  const addressList = addressesData?.data ?? [];

  const createTenant = useCreateTenantMaterial();
  const createSupplier = useCreateSupplierMaterial();
  const createCustomer = useCreateCustomerMaterial();
  const createDisposal = useCreateDisposalMaterial();

  const selectedCategory = categories.find((c) => c.id === categoryId);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data: Record<string, unknown> = {
      name: formData.get("name"),
      unitOfMeasure,
    };

    if (subcategoryId) data.subcategoryId = subcategoryId;
    if (addressId) data.addressId = addressId;

    const desc = formData.get("description") as string;
    if (desc) data.description = desc;

    const density = formData.get("densityFactor") as string;
    if (density) data.densityFactor = parseFloat(density);

    const notes = formData.get("notes") as string;
    if (notes) data.notes = notes;

    // Compliance flags
    const isHazardous = formData.get("isHazardous") === "on";
    const isDangerousGoods = formData.get("isDangerousGoods") === "on";
    const isRegulatedWaste = formData.get("isRegulatedWaste") === "on";
    const requiresTracking = formData.get("requiresTracking") === "on";
    if (isHazardous || isDangerousGoods || isRegulatedWaste || requiresTracking) {
      const compliance: Record<string, unknown> = {
        isHazardous,
        isDangerousGoods,
        isRegulatedWaste,
        requiresTracking,
        requiresAuthority: formData.get("requiresAuthority") === "on",
      };
      if (isDangerousGoods) {
        const unNumber = formData.get("unNumber") as string;
        if (unNumber) compliance.unNumber = unNumber;
        const dgClass = formData.get("dgClass") as string;
        if (dgClass) compliance.dgClass = dgClass;
        const packingGroup = formData.get("packingGroup") as string;
        if (packingGroup) compliance.packingGroup = packingGroup;
      }
      if (isRegulatedWaste) {
        const wasteCode = formData.get("wasteCode") as string;
        if (wasteCode) compliance.wasteCode = wasteCode;
        const epaCategory = formData.get("epaCategory") as string;
        if (epaCategory) compliance.epaCategory = epaCategory;
      }
      data.compliance = compliance;
    }

    // Source-specific fields
    if (sourceType === "supplier") {
      data.supplierId = companyId;
      const supplierCompany = suppliers.find((s) => s.id === companyId);
      data.supplierName = formData.get("supplierName") || supplierCompany?.name || "";
      const purchasePrice = formData.get("purchasePrice") as string;
      if (purchasePrice) data.purchasePrice = parseFloat(purchasePrice);
      const productCode = formData.get("supplierProductCode") as string;
      if (productCode) data.supplierProductCode = productCode;
      const minQty = formData.get("minimumOrderQty") as string;
      if (minQty) data.minimumOrderQty = parseFloat(minQty);
    } else if (sourceType === "customer") {
      data.customerId = companyId;
      const customerCompany = customers.find((c) => c.id === companyId);
      data.customerName = formData.get("customerName") || customerCompany?.name || "";
      const salePrice = formData.get("salePrice") as string;
      if (salePrice) data.salePrice = parseFloat(salePrice);
    } else if (sourceType === "disposal") {
      data.addressId = addressId;
      data.materialMode = materialMode;
      if (materialMode === "disposal") {
        const tipFee = formData.get("tipFee") as string;
        if (tipFee) data.tipFee = parseFloat(tipFee);
        const envLevy = formData.get("environmentalLevy") as string;
        if (envLevy) data.environmentalLevy = parseFloat(envLevy);
        const minCharge = formData.get("minimumCharge") as string;
        if (minCharge) data.minimumCharge = parseFloat(minCharge);
      } else {
        const salePrice = formData.get("salePrice") as string;
        if (salePrice) data.salePrice = parseFloat(salePrice);
      }
    }

    const createFn =
      sourceType === "tenant"
        ? createTenant
        : sourceType === "supplier"
          ? createSupplier
          : sourceType === "customer"
            ? createCustomer
            : createDisposal;

    createFn.mutate(data, {
      onSuccess: (result) => {
        toast.success("Material created");
        void navigate(`/materials/${sourceType}/${result.id}`);
      },
      onError: () => toast.error("Failed to create material"),
    });
  }

  const isPending =
    createTenant.isPending ||
    createSupplier.isPending ||
    createCustomer.isPending ||
    createDisposal.isPending;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Add Material</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a new material to your catalog.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Source Type */}
        <Card>
          <CardHeader>
            <CardTitle>Source Type</CardTitle>
            <CardDescription>
              Where does this material come from?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Source</Label>
              <Select
                value={sourceType}
                onValueChange={(v) => {
                  setSourceType(v as SourceType);
                  setCompanyId("");
                  setAddressId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tenant">Own Stock</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="disposal">Disposal Site</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {sourceType === "supplier" ? (
              <div className="space-y-2">
                <Label>Supplier Company *</Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : sourceType === "customer" ? (
              <div className="space-y-2">
                <Label>Customer Company *</Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
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
            ) : null}

            {sourceType === "disposal" ? (
              <div className="space-y-2">
                <Label>Material Mode *</Label>
                <Select value={materialMode} onValueChange={setMaterialMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disposal">Disposal (accepts waste)</SelectItem>
                    <SelectItem value="supply">Supply (sells recycled)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Core Details */}
        <Card>
          <CardHeader>
            <CardTitle>Material Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Material Name *</Label>
                <Input id="name" name="name" required placeholder="e.g. Clean Fill, 20mm Aggregate" />
              </div>
              <div className="space-y-2">
                <Label>Unit of Measure *</Label>
                <Select value={unitOfMeasure} onValueChange={setUnitOfMeasure}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {UOM_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" placeholder="Optional description" />
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={categoryId}
                  onValueChange={(v) => {
                    setCategoryId(v);
                    setSubcategoryId("");
                  }}
                >
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Location / Address</Label>
                <Select value={addressId} onValueChange={setAddressId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select address" />
                  </SelectTrigger>
                  <SelectContent>
                    {addressList.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.streetAddress}, {a.suburb}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="densityFactor">Density Factor (t/m\u00B3)</Label>
                <Input
                  id="densityFactor"
                  name="densityFactor"
                  type="number"
                  step="0.0001"
                  placeholder="e.g. 1.5"
                />
              </div>
            </div>

            {sourceType === "supplier" ? (
              <>
                <Separator />
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="supplierName">Supplier&apos;s Name for Material</Label>
                    <Input id="supplierName" name="supplierName" placeholder="Their product name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplierProductCode">Supplier Product Code</Label>
                    <Input id="supplierProductCode" name="supplierProductCode" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minimumOrderQty">Min Order Qty</Label>
                    <Input id="minimumOrderQty" name="minimumOrderQty" type="number" step="0.01" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchasePrice">Purchase Price ($)</Label>
                  <Input id="purchasePrice" name="purchasePrice" type="number" step="0.01" placeholder="0.00" />
                </div>
              </>
            ) : null}

            {sourceType === "customer" ? (
              <>
                <Separator />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="customerName">Customer&apos;s Name for Material</Label>
                    <Input id="customerName" name="customerName" placeholder="Their name for it" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salePrice">Sale Price ($)</Label>
                    <Input id="salePrice" name="salePrice" type="number" step="0.01" placeholder="0.00" />
                  </div>
                </div>
              </>
            ) : null}

            {sourceType === "disposal" && materialMode === "disposal" ? (
              <>
                <Separator />
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="tipFee">Tip Fee ($)</Label>
                    <Input id="tipFee" name="tipFee" type="number" step="0.01" placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="environmentalLevy">Environmental Levy ($)</Label>
                    <Input id="environmentalLevy" name="environmentalLevy" type="number" step="0.01" placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minimumCharge">Minimum Charge ($)</Label>
                    <Input id="minimumCharge" name="minimumCharge" type="number" step="0.01" placeholder="0.00" />
                  </div>
                </div>
              </>
            ) : sourceType === "disposal" && materialMode === "supply" ? (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="salePrice">Sale Price ($)</Label>
                  <Input id="salePrice" name="salePrice" type="number" step="0.01" placeholder="0.00" />
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Compliance */}
        <Card>
          <CardHeader>
            <CardTitle>Compliance</CardTitle>
            <CardDescription>
              Flag hazardous, dangerous goods, or regulated waste requirements.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isHazardous" className="h-4 w-4 rounded border" />
                Hazardous Material
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isDangerousGoods" className="h-4 w-4 rounded border" />
                Dangerous Goods (DG)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isRegulatedWaste" className="h-4 w-4 rounded border" />
                Regulated Waste
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="requiresTracking" className="h-4 w-4 rounded border" />
                Requires Tracking
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="requiresAuthority" className="h-4 w-4 rounded border" />
                Requires Authority
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="unNumber">UN Number</Label>
                <Input id="unNumber" name="unNumber" placeholder="e.g. UN1234" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dgClass">DG Class</Label>
                <Input id="dgClass" name="dgClass" placeholder="1-9" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="packingGroup">Packing Group</Label>
                <Input id="packingGroup" name="packingGroup" placeholder="I, II, or III" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wasteCode">EPA Waste Code</Label>
                <Input id="wasteCode" name="wasteCode" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="epaCategory">EPA Category</Label>
                <Input id="epaCategory" name="epaCategory" />
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
            <Textarea name="notes" placeholder="Any additional notes..." rows={3} />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void navigate("/materials")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!unitOfMeasure || isPending}>
            {isPending ? "Creating..." : "Create Material"}
          </Button>
        </div>
      </form>
    </div>
  );
}
