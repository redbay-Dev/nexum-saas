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
import { useAssetCategories } from "@frontend/api/asset-categories.js";
import { useCreateJobAssetRequirement } from "@frontend/api/jobs.js";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { AssetSubcategory } from "@frontend/api/asset-categories.js";

interface AddAssetRequirementDialogProps {
  jobId: string;
}

export function AddAssetRequirementDialog({ jobId }: AddAssetRequirementDialogProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [payloadLimit, setPayloadLimit] = useState("");
  const [specialRequirements, setSpecialRequirements] = useState("");

  const { data: categoriesData } = useAssetCategories();
  const createRequirement = useCreateJobAssetRequirement(jobId);

  const categories = categoriesData?.data ?? [];
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const subcategories: AssetSubcategory[] = selectedCategory?.subcategories ?? [];

  function resetForm(): void {
    setCategoryId("");
    setSubcategoryId("");
    setQuantity("1");
    setPayloadLimit("");
    setSpecialRequirements("");
  }

  function handleCategoryChange(value: string): void {
    setCategoryId(value);
    setSubcategoryId("");
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();

    if (!categoryId) {
      toast.error("Asset category is required");
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }

    const data: Record<string, unknown> = {
      assetCategoryId: categoryId,
      quantity: qty,
    };

    if (subcategoryId) data.assetSubcategoryId = subcategoryId;
    if (payloadLimit) data.payloadLimit = parseFloat(payloadLimit);
    if (specialRequirements) data.specialRequirements = specialRequirements;

    createRequirement.mutate(data, {
      onSuccess: () => {
        toast.success("Asset requirement added");
        resetForm();
        setOpen(false);
      },
      onError: () => toast.error("Failed to add asset requirement"),
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Requirement
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Asset Requirement</DialogTitle>
            <DialogDescription>
              Specify what type and quantity of asset this job needs.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={handleCategoryChange}>
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
            {subcategories.length > 0 ? (
              <div className="grid gap-2">
                <Label>Subcategory</Label>
                <Select value={subcategoryId} onValueChange={setSubcategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subcategory (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategories.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Payload Limit (t)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={payloadLimit}
                  onChange={(e) => setPayloadLimit(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Special Requirements</Label>
              <Textarea
                value={specialRequirements}
                onChange={(e) => setSpecialRequirements(e.target.value)}
                placeholder="Any special requirements for this asset type"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createRequirement.isPending}>
              {createRequirement.isPending ? "Adding..." : "Add Requirement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
