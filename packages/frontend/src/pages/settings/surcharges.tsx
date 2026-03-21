import { useState } from "react";
import { useSurcharges, useCreateSurcharge, useDeleteSurcharge } from "@frontend/api/surcharges.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@frontend/components/ui/card.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@frontend/components/ui/select.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@frontend/components/ui/dialog.js";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@frontend/components/ui/table.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { useAuth } from "@frontend/hooks/use-auth.js";

const PRICING_CATEGORIES = [
  { value: "hire", label: "Hire" },
  { value: "cartage", label: "Cartage" },
  { value: "tip_fee", label: "Tip Fee" },
  { value: "material", label: "Material" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "equipment", label: "Equipment" },
  { value: "labour", label: "Labour" },
  { value: "other", label: "Other" },
];

export function SurchargesSettingsPage(): React.JSX.Element {
  const { can } = useAuth();
  const { data: surchargeList, isLoading } = useSurcharges();
  const createSurcharge = useCreateSurcharge();
  const deleteSurcharge = useDeleteSurcharge();
  const [showCreate, setShowCreate] = useState(false);
  const [newSurcharge, setNewSurcharge] = useState({
    name: "",
    type: "percentage",
    value: "",
    appliesTo: [] as string[],
    effectiveFrom: "",
    autoApply: true,
  });

  function toggleCategory(cat: string): void {
    setNewSurcharge((p) => ({
      ...p,
      appliesTo: p.appliesTo.includes(cat)
        ? p.appliesTo.filter((c) => c !== cat)
        : [...p.appliesTo, cat],
    }));
  }

  function handleCreate(): void {
    if (!newSurcharge.name || !newSurcharge.value || newSurcharge.appliesTo.length === 0 || !newSurcharge.effectiveFrom) {
      toast.error("Name, value, at least one category, and effective from date are required");
      return;
    }
    createSurcharge.mutate(
      {
        name: newSurcharge.name,
        type: newSurcharge.type,
        value: parseFloat(newSurcharge.value),
        appliesTo: newSurcharge.appliesTo,
        effectiveFrom: newSurcharge.effectiveFrom,
        autoApply: newSurcharge.autoApply,
      },
      {
        onSuccess: () => {
          toast.success("Surcharge created");
          setShowCreate(false);
          setNewSurcharge({ name: "", type: "percentage", value: "", appliesTo: [], effectiveFrom: "", autoApply: true });
        },
        onError: () => toast.error("Failed to create surcharge"),
      },
    );
  }

  function handleDelete(id: string, name: string): void {
    if (!confirm(`Delete surcharge "${name}"?`)) return;
    deleteSurcharge.mutate(id, {
      onSuccess: () => toast.success("Surcharge deleted"),
      onError: () => toast.error("Failed to delete surcharge"),
    });
  }

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Surcharges & Levies</h2>
          <p className="text-muted-foreground">Auto-applied charges like fuel levies and environmental surcharges. Each is a separate line item on invoices.</p>
        </div>
        {can("manage:pricing") && (
          <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />New Surcharge</Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Surcharges</CardTitle>
          <CardDescription>Auto-apply surcharges are added to new pricing lines matching the configured categories.</CardDescription>
        </CardHeader>
        <CardContent>
          {!surchargeList || surchargeList.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No surcharges configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Applies To</TableHead>
                  <TableHead>Auto-Apply</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Status</TableHead>
                  {can("manage:pricing") && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {surchargeList.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="outline">{s.type === "percentage" ? "%" : "$"}</Badge></TableCell>
                    <TableCell className="text-right font-mono">
                      {s.type === "percentage" ? `${parseFloat(s.value)}%` : `$${parseFloat(s.value).toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {s.appliesTo.map((cat) => (
                          <Badge key={cat} variant="secondary" className="text-xs">
                            {PRICING_CATEGORIES.find((c) => c.value === cat)?.label ?? cat}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{s.autoApply ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.effectiveFrom}{s.effectiveTo ? ` — ${s.effectiveTo}` : "+"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.isActive ? "default" : "secondary"}>{s.isActive ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    {can("manage:pricing") && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id, s.name)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Surcharge</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={newSurcharge.name} onChange={(e) => setNewSurcharge((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Fuel Levy" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newSurcharge.type} onValueChange={(v) => setNewSurcharge((p) => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage of base rate</SelectItem>
                    <SelectItem value="fixed">Fixed amount per unit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{newSurcharge.type === "percentage" ? "Percentage (%)" : "Amount ($)"}</Label>
                <Input type="number" step="0.01" value={newSurcharge.value} onChange={(e) => setNewSurcharge((p) => ({ ...p, value: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Effective From</Label>
              <Input type="date" value={newSurcharge.effectiveFrom} onChange={(e) => setNewSurcharge((p) => ({ ...p, effectiveFrom: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Applies To (select categories)</Label>
              <div className="flex flex-wrap gap-2">
                {PRICING_CATEGORIES.map((cat) => (
                  <Badge
                    key={cat.value}
                    variant={newSurcharge.appliesTo.includes(cat.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleCategory(cat.value)}
                  >
                    {cat.label}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="auto-apply"
                checked={newSurcharge.autoApply}
                onChange={(e) => setNewSurcharge((p) => ({ ...p, autoApply: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="auto-apply">Auto-apply to new pricing lines</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createSurcharge.isPending}>{createSurcharge.isPending ? "Creating..." : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
