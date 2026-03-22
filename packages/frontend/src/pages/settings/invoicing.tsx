import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@frontend/components/ui/card.js";
import { toast } from "sonner";

interface InvoiceSequence {
  id: string;
  sequenceType: string;
  prefix: string | null;
  suffix: string | null;
  nextNumber: number;
  minDigits: number;
}

function useInvoiceSequences(): ReturnType<typeof useQuery<InvoiceSequence[]>> {
  return useQuery({
    queryKey: ["invoice-settings", "sequences"],
    queryFn: () => api.get<InvoiceSequence[]>("/api/v1/invoice-settings/sequences"),
  });
}

function useUpdateSequence(): ReturnType<
  typeof useMutation<InvoiceSequence, Error, { id: string; data: Partial<InvoiceSequence> }>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InvoiceSequence> }) =>
      api.put<InvoiceSequence>(`/api/v1/invoice-settings/sequences/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-settings", "sequences"] });
    },
  });
}

function SequenceCard({ sequence }: { sequence: InvoiceSequence }): React.JSX.Element {
  const updateSequence = useUpdateSequence();
  const [form, setForm] = useState({
    prefix: sequence.prefix ?? "",
    suffix: sequence.suffix ?? "",
    nextNumber: String(sequence.nextNumber),
    minDigits: String(sequence.minDigits),
  });

  useEffect(() => {
    setForm({
      prefix: sequence.prefix ?? "",
      suffix: sequence.suffix ?? "",
      nextNumber: String(sequence.nextNumber),
      minDigits: String(sequence.minDigits),
    });
  }, [sequence]);

  function updateForm(field: string, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Preview the next number
  const padded = String(parseInt(form.nextNumber) || 1).padStart(parseInt(form.minDigits) || 4, "0");
  const preview = `${form.prefix}${padded}${form.suffix}`;

  async function handleSave(): Promise<void> {
    try {
      await updateSequence.mutateAsync({
        id: sequence.id,
        data: {
          prefix: form.prefix || undefined,
          suffix: form.suffix || undefined,
          nextNumber: parseInt(form.nextNumber) || undefined,
          minDigits: parseInt(form.minDigits) || undefined,
        },
      });
      toast.success("Sequence updated");
    } catch {
      toast.error("Failed to update sequence");
    }
  }

  const labels: Record<string, string> = {
    invoice: "Invoice",
    rcti: "RCTI",
    credit_note: "Credit Note",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels[sequence.sequenceType] ?? sequence.sequenceType} Numbering</CardTitle>
        <CardDescription>Preview: <span className="font-mono font-medium">{preview}</span></CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Prefix</Label>
            <Input value={form.prefix} onChange={(e) => updateForm("prefix", e.target.value)} placeholder="INV-" />
          </div>
          <div className="space-y-2">
            <Label>Next Number</Label>
            <Input type="number" value={form.nextNumber} onChange={(e) => updateForm("nextNumber", e.target.value)} min="1" />
          </div>
          <div className="space-y-2">
            <Label>Min Digits</Label>
            <Input type="number" value={form.minDigits} onChange={(e) => updateForm("minDigits", e.target.value)} min="1" max="10" />
          </div>
          <div className="space-y-2">
            <Label>Suffix</Label>
            <Input value={form.suffix} onChange={(e) => updateForm("suffix", e.target.value)} placeholder="" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => void handleSave()} disabled={updateSequence.isPending} size="sm">
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function InvoicingSettingsPage(): React.JSX.Element {
  const { data: sequences, isLoading } = useInvoiceSequences();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Invoicing Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure invoice and RCTI number sequences
        </p>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-4">
          {(sequences ?? []).map((seq) => (
            <SequenceCard key={seq.id} sequence={seq} />
          ))}
        </div>
      )}
    </div>
  );
}
