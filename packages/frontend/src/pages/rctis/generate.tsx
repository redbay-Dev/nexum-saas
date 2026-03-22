import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useGenerateRcti } from "@frontend/api/rctis.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import { toast } from "sonner";

export function GenerateRctiPage(): React.JSX.Element {
  const navigate = useNavigate();
  const generateRcti = useGenerateRcti();

  const [form, setForm] = useState({
    contractorId: "",
    periodStart: "",
    periodEnd: "",
  });

  function updateForm(field: string, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleGenerate(): Promise<void> {
    if (!form.contractorId.trim() || !form.periodStart || !form.periodEnd) {
      toast.error("All fields are required");
      return;
    }

    try {
      const rcti = await generateRcti.mutateAsync({
        contractorId: form.contractorId,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
      });
      toast.success(`RCTI ${rcti.rctiNumber} generated`);
      void navigate(`/rctis/${rcti.id}`);
    } catch {
      toast.error("Failed to generate RCTI — check there are approved cost charges in this period");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/rctis"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">Generate RCTI</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>RCTI Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Contractor ID</Label>
            <Input
              value={form.contractorId}
              onChange={(e) => updateForm("contractorId", e.target.value)}
              placeholder="UUID of contractor company"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Period Start</Label>
              <Input type="date" value={form.periodStart} onChange={(e) => updateForm("periodStart", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Period End</Label>
              <Input type="date" value={form.periodEnd} onChange={(e) => updateForm("periodEnd", e.target.value)} />
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            This will generate an RCTI from all approved cost charges for this contractor within the specified period.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild>
              <Link to="/rctis">Cancel</Link>
            </Button>
            <Button onClick={() => void handleGenerate()} disabled={generateRcti.isPending}>
              Generate RCTI
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
