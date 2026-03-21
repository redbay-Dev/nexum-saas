import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@frontend/components/ui/dialog.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Textarea } from "@frontend/components/ui/textarea.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@frontend/components/ui/select.js";
import { useDeallocateAssignment } from "@frontend/api/scheduling.js";
import { DEALLOCATION_REASONS } from "@nexum/shared";
import type { DeallocationReason } from "@nexum/shared";
import { toast } from "sonner";

const REASON_LABELS: Record<string, string> = {
  reassignment: "Reassignment",
  no_longer_needed: "No Longer Needed",
  compliance_issue: "Compliance Issue",
  breakdown: "Breakdown",
  weather: "Weather",
  customer_request: "Customer Request",
  other: "Other",
};

interface DeallocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignmentId: string;
  resourceLabel: string;
}

export function DeallocationDialog({
  open,
  onOpenChange,
  assignmentId,
  resourceLabel,
}: DeallocationDialogProps): React.JSX.Element {
  const [reason, setReason] = useState<DeallocationReason | "">("");
  const [notes, setNotes] = useState("");
  const [completedLoads, setCompletedLoads] = useState<string>("");
  const deallocate = useDeallocateAssignment();

  function handleSubmit(): void {
    if (!reason) {
      toast.error("Please select a reason");
      return;
    }

    deallocate.mutate(
      {
        assignmentId,
        reason,
        notes: notes || undefined,
        completedLoads: completedLoads ? parseInt(completedLoads, 10) : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Resource deallocated");
          onOpenChange(false);
          setReason("");
          setNotes("");
          setCompletedLoads("");
        },
        onError: () => {
          toast.error("Failed to deallocate");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deallocate Resource</DialogTitle>
          <DialogDescription>
            Remove <strong>{resourceLabel}</strong> from this job.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as DeallocationReason)}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {DEALLOCATION_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{REASON_LABELS[r] ?? r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Completed Loads (optional)</Label>
            <Input
              type="number"
              min={0}
              value={completedLoads}
              onChange={(e) => setCompletedLoads(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!reason || deallocate.isPending}
          >
            {deallocate.isPending ? "Deallocating..." : "Deallocate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
