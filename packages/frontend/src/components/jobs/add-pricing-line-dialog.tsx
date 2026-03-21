import { useState, useEffect } from "react";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
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
import { useCreateJobPricingLine } from "@frontend/api/jobs.js";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  JOB_PRICING_LINE_TYPES,
  JOB_PRICING_RATE_TYPES,
  JOB_PRICING_CATEGORIES,
} from "@nexum/shared";

interface AddPricingLineDialogProps {
  jobId: string;
}

const LINE_TYPE_LABELS: Record<string, string> = {
  revenue: "Revenue",
  cost: "Cost",
};

const RATE_TYPE_LABELS: Record<string, string> = {
  per_hour: "Per Hour",
  per_tonne: "Per Tonne",
  per_cubic_metre: "Per Cubic Metre",
  per_km: "Per Kilometre",
  per_load: "Per Load",
  flat: "Flat Rate",
};

const CATEGORY_LABELS: Record<string, string> = {
  hire: "Hire",
  cartage: "Cartage",
  tip_fee: "Tip Fee",
  material: "Material",
  subcontractor: "Subcontractor",
  fuel_levy: "Fuel Levy",
  other: "Other",
};

export function AddPricingLineDialog({ jobId }: AddPricingLineDialogProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [lineType, setLineType] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [rateType, setRateType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitRate, setUnitRate] = useState("");
  const [total, setTotal] = useState("");

  const createPricingLine = useCreateJobPricingLine(jobId);

  useEffect(() => {
    const qty = parseFloat(quantity);
    const rate = parseFloat(unitRate);
    if (!isNaN(qty) && !isNaN(rate)) {
      setTotal((qty * rate).toFixed(2));
    }
  }, [quantity, unitRate]);

  function resetForm(): void {
    setLineType("");
    setCategory("");
    setRateType("");
    setDescription("");
    setQuantity("");
    setUnitRate("");
    setTotal("");
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();

    if (!lineType || !category || !rateType) {
      toast.error("Line type, category, and rate type are required");
      return;
    }

    const totalValue = parseFloat(total);
    if (isNaN(totalValue) || totalValue < 0) {
      toast.error("Total must be a valid positive number");
      return;
    }

    const data: Record<string, unknown> = {
      lineType,
      category,
      rateType,
      quantity: parseFloat(quantity) || 0,
      unitRate: parseFloat(unitRate) || 0,
      total: totalValue,
    };

    if (description) data.description = description;

    createPricingLine.mutate(data, {
      onSuccess: () => {
        toast.success("Pricing line added");
        resetForm();
        setOpen(false);
      },
      onError: () => toast.error("Failed to add pricing line"),
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Pricing Line
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Pricing Line</DialogTitle>
            <DialogDescription>
              Add a revenue or cost line to this job.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Line Type</Label>
                <Select value={lineType} onValueChange={setLineType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Revenue / Cost" />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_PRICING_LINE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {LINE_TYPE_LABELS[type] ?? type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_PRICING_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_LABELS[cat] ?? cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Line description (optional)"
              />
            </div>
            <div className="grid gap-2">
              <Label>Rate Type</Label>
              <Select value={rateType} onValueChange={setRateType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rate type" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_PRICING_RATE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {RATE_TYPE_LABELS[type] ?? type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
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
                <Label>Unit Rate ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitRate}
                  onChange={(e) => setUnitRate(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label>Total ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPricingLine.isPending}>
              {createPricingLine.isPending ? "Adding..." : "Add Pricing Line"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
