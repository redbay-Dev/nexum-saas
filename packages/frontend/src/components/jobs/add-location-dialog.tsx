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
import { useAddresses } from "@frontend/api/addresses.js";
import { useCreateJobLocation } from "@frontend/api/jobs.js";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { JOB_LOCATION_TYPES } from "@nexum/shared";
import type { Address } from "@frontend/api/addresses.js";

interface AddLocationDialogProps {
  jobId: string;
}

export function AddLocationDialog({ jobId }: AddLocationDialogProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [locationType, setLocationType] = useState<string>("");
  const [addressId, setAddressId] = useState<string>("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [instructions, setInstructions] = useState("");
  const [tipFee, setTipFee] = useState("");

  const { data: addressesData } = useAddresses({ limit: 100 });
  const createLocation = useCreateJobLocation(jobId);

  const addresses: Address[] = addressesData?.data ?? [];

  function resetForm(): void {
    setLocationType("");
    setAddressId("");
    setContactName("");
    setContactPhone("");
    setInstructions("");
    setTipFee("");
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();

    if (!locationType || !addressId) {
      toast.error("Location type and address are required");
      return;
    }

    const data: Record<string, unknown> = {
      locationType,
      addressId,
    };

    if (contactName) data.contactName = contactName;
    if (contactPhone) data.contactPhone = contactPhone;
    if (instructions) data.instructions = instructions;
    if (tipFee) data.tipFee = parseFloat(tipFee);

    createLocation.mutate(data, {
      onSuccess: () => {
        toast.success("Location added");
        resetForm();
        setOpen(false);
      },
      onError: () => toast.error("Failed to add location"),
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Location
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Location</DialogTitle>
            <DialogDescription>Add a pickup or delivery location to this job.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="locationType">Location Type</Label>
              <Select value={locationType} onValueChange={setLocationType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_LOCATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="addressId">Address</Label>
              <Select value={addressId} onValueChange={setAddressId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select address" />
                </SelectTrigger>
                <SelectContent>
                  {addresses.map((addr) => (
                    <SelectItem key={addr.id} value={addr.id}>
                      {addr.streetAddress}, {addr.suburb} {addr.state} {addr.postcode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contactName">Contact Name</Label>
                <Input
                  id="contactName"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tipFee">Tip Fee ($)</Label>
              <Input
                id="tipFee"
                type="number"
                min="0"
                step="0.01"
                value={tipFee}
                onChange={(e) => setTipFee(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Site access instructions, directions, etc."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createLocation.isPending}>
              {createLocation.isPending ? "Adding..." : "Add Location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
