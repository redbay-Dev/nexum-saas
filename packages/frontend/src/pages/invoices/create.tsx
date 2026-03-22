import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { useCreateInvoice } from "@frontend/api/invoices.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Textarea } from "@frontend/components/ui/textarea.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@frontend/components/ui/card.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select.js";
import { toast } from "sonner";

export function CreateInvoicePage(): React.JSX.Element {
  const navigate = useNavigate();
  const createInvoice = useCreateInvoice();

  const [form, setForm] = useState({
    customerId: "",
    chargeIdsText: "",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    groupingMode: "per_job",
    poNumber: "",
    notes: "",
  });

  function updateForm(field: string, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreate(): Promise<void> {
    if (!form.customerId.trim()) {
      toast.error("Customer ID is required");
      return;
    }

    const chargeIds = form.chargeIdsText
      .split(/[\n,]/)
      .map((id) => id.trim())
      .filter(Boolean);

    if (chargeIds.length === 0) {
      toast.error("At least one charge ID is required");
      return;
    }

    try {
      const invoice = await createInvoice.mutateAsync({
        customerId: form.customerId,
        chargeIds,
        issueDate: form.issueDate,
        dueDate: form.dueDate || undefined,
        groupingMode: form.groupingMode || undefined,
        poNumber: form.poNumber || undefined,
        notes: form.notes || undefined,
      });
      toast.success(`Invoice ${invoice.invoiceNumber} created`);
      void navigate(`/invoices/${invoice.id}`);
    } catch {
      toast.error("Failed to create invoice");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/invoices">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Create Invoice</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Customer ID</Label>
              <Input
                value={form.customerId}
                onChange={(e) => updateForm("customerId", e.target.value)}
                placeholder="UUID of customer company"
              />
            </div>
            <div className="space-y-2">
              <Label>Grouping Mode</Label>
              <Select value={form.groupingMode} onValueChange={(v) => updateForm("groupingMode", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_job">Per Job</SelectItem>
                  <SelectItem value="per_po">Per PO</SelectItem>
                  <SelectItem value="per_project">Per Project</SelectItem>
                  <SelectItem value="per_site">Per Site</SelectItem>
                  <SelectItem value="combine_all">Combine All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Issue Date</Label>
              <Input type="date" value={form.issueDate} onChange={(e) => updateForm("issueDate", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Due Date (optional — defaults to payment terms)</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => updateForm("dueDate", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>PO Number (optional)</Label>
            <Input value={form.poNumber} onChange={(e) => updateForm("poNumber", e.target.value)} placeholder="Customer PO reference" />
          </div>

          <div className="space-y-2">
            <Label>Charge IDs (one per line or comma-separated)</Label>
            <Textarea
              value={form.chargeIdsText}
              onChange={(e) => updateForm("chargeIdsText", e.target.value)}
              placeholder="Paste approved charge UUIDs here..."
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              Enter the UUIDs of approved revenue charges to include in this invoice.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} placeholder="Invoice notes..." />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild>
              <Link to="/invoices">Cancel</Link>
            </Button>
            <Button onClick={() => void handleCreate()} disabled={createInvoice.isPending}>
              Create Invoice
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
