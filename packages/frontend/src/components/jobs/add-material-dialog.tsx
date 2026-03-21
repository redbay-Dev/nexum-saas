import { useState } from "react";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Textarea } from "@frontend/components/ui/textarea.js";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select.js";
import {
  useTenantMaterials,
  useSupplierMaterials,
  useCustomerMaterials,
  useDisposalMaterials,
} from "@frontend/api/materials.js";
import { useCreateJobMaterial } from "@frontend/api/jobs.js";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  MATERIAL_SOURCE_TYPES,
  MATERIAL_FLOW_TYPES,
  UNITS_OF_MEASURE,
} from "@nexum/shared";

interface AddMaterialDialogProps {
  jobId: string;
}

const SOURCE_LABELS: Record<string, string> = {
  tenant: "Own Stock",
  supplier: "Supplier",
  customer: "Customer",
  disposal: "Disposal",
};

const FLOW_LABELS: Record<string, string> = {
  supply: "Supply",
  disposal: "Disposal",
  buyback: "Buyback",
  transfer: "Transfer",
  delivery: "Delivery",
};

const UNIT_LABELS: Record<string, string> = {
  tonne: "Tonne",
  cubic_metre: "Cubic Metre",
  load: "Load",
  hour: "Hour",
  kilometre: "Kilometre",
};

interface MaterialOption {
  id: string;
  name: string;
}

export function AddMaterialDialog({ jobId }: AddMaterialDialogProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [sourceType, setSourceType] = useState<string>("");
  const [materialId, setMaterialId] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [unitOfMeasure, setUnitOfMeasure] = useState<string>("");
  const [flowType, setFlowType] = useState<string>("");
  const [notes, setNotes] = useState("");

  const { data: tenantData } = useTenantMaterials({ limit: 100 });
  const { data: supplierData } = useSupplierMaterials({ limit: 100 });
  const { data: customerData } = useCustomerMaterials({ limit: 100 });
  const { data: disposalData } = useDisposalMaterials({ limit: 100 });
  const createMaterial = useCreateJobMaterial(jobId);

  function getMaterialOptions(): MaterialOption[] {
    switch (sourceType) {
      case "tenant":
        return (tenantData?.data ?? []).map((m) => ({ id: m.id, name: m.name }));
      case "supplier":
        return (supplierData?.data ?? []).map((m) => ({ id: m.id, name: `${m.name} (${m.companyName ?? m.supplierName})` }));
      case "customer":
        return (customerData?.data ?? []).map((m) => ({ id: m.id, name: `${m.name} (${m.companyName ?? m.customerName})` }));
      case "disposal":
        return (disposalData?.data ?? []).map((m) => ({ id: m.id, name: m.name }));
      default:
        return [];
    }
  }

  function resetForm(): void {
    setSourceType("");
    setMaterialId("");
    setQuantity("");
    setUnitOfMeasure("");
    setFlowType("");
    setNotes("");
  }

  function handleSourceTypeChange(value: string): void {
    setSourceType(value);
    setMaterialId("");
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();

    if (!sourceType || !materialId) {
      toast.error("Source type and material are required");
      return;
    }

    const data: Record<string, unknown> = {
      materialSourceType: sourceType,
      materialSourceId: materialId,
    };

    if (quantity) data.quantity = parseFloat(quantity);
    if (unitOfMeasure) data.unitOfMeasure = unitOfMeasure;
    if (flowType) data.flowType = flowType;
    if (notes) data.notes = notes;

    createMaterial.mutate(data, {
      onSuccess: () => {
        toast.success("Material added");
        resetForm();
        setOpen(false);
      },
      onError: () => toast.error("Failed to add material"),
    });
  }

  const materialOptions = getMaterialOptions();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Material
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Material</DialogTitle>
            <DialogDescription>
              Select a material to snapshot onto this job. The material data is captured at this point in time.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Source Type</Label>
              <Select value={sourceType} onValueChange={handleSourceTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_SOURCE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {SOURCE_LABELS[type] ?? type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {sourceType ? (
              <div className="grid gap-2">
                <Label>Material</Label>
                <Select value={materialId} onValueChange={setMaterialId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materialOptions.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        No materials found
                      </SelectItem>
                    ) : (
                      materialOptions.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label>Unit</Label>
                <Select value={unitOfMeasure} onValueChange={setUnitOfMeasure}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS_OF_MEASURE.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {UNIT_LABELS[unit] ?? unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Flow Type</Label>
              <Select value={flowType} onValueChange={setFlowType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select flow type" />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_FLOW_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {FLOW_LABELS[type] ?? type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMaterial.isPending}>
              {createMaterial.isPending ? "Adding..." : "Add Material"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
