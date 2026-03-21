import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useRateCard, useUpdateRateCard, useCreateRateCardEntry, useDeleteRateCardEntry } from "@frontend/api/rate-cards.js";
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
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@frontend/hooks/use-auth.js";

const PRICING_CATEGORIES = [
  { value: "hire", label: "Hire" },
  { value: "cartage", label: "Cartage" },
  { value: "tip_fee", label: "Tip Fee" },
  { value: "material", label: "Material" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "equipment", label: "Equipment" },
  { value: "labour", label: "Labour" },
  { value: "fuel_levy", label: "Fuel Levy" },
  { value: "other", label: "Other" },
];

const RATE_TYPES = [
  { value: "per_hour", label: "Per Hour" },
  { value: "per_tonne", label: "Per Tonne" },
  { value: "per_cubic_metre", label: "Per m\u00B3" },
  { value: "per_km", label: "Per km" },
  { value: "per_load", label: "Per Load" },
  { value: "flat", label: "Flat" },
];

export function RateCardDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: rateCard, isLoading } = useRateCard(id ?? "");
  const updateRateCard = useUpdateRateCard(id ?? "");
  const createEntry = useCreateRateCardEntry(id ?? "");
  const deleteEntry = useDeleteRateCardEntry(id ?? "");
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [newEntry, setNewEntry] = useState({
    category: "",
    rateType: "",
    unitRate: "",
    description: "",
  });

  function handleToggleActive(): void {
    if (!rateCard) return;
    updateRateCard.mutate(
      { isActive: !rateCard.isActive },
      {
        onSuccess: () => toast.success(rateCard.isActive ? "Rate card deactivated" : "Rate card activated"),
        onError: () => toast.error("Failed to update rate card"),
      },
    );
  }

  function handleAddEntry(): void {
    if (!newEntry.category || !newEntry.rateType || !newEntry.unitRate) {
      toast.error("Category, rate type, and unit rate are required");
      return;
    }
    createEntry.mutate(
      {
        category: newEntry.category,
        rateType: newEntry.rateType,
        unitRate: parseFloat(newEntry.unitRate),
        description: newEntry.description || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Entry added");
          setShowAddEntry(false);
          setNewEntry({ category: "", rateType: "", unitRate: "", description: "" });
        },
        onError: () => toast.error("Failed to add entry"),
      },
    );
  }

  function handleDeleteEntry(entryId: string): void {
    deleteEntry.mutate(entryId, {
      onSuccess: () => toast.success("Entry removed"),
      onError: () => toast.error("Failed to remove entry"),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!rateCard) {
    return <p className="text-muted-foreground">Rate card not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => void navigate("/settings/rate-cards")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight">{rateCard.name}</h2>
          <p className="text-sm text-muted-foreground">
            {rateCard.effectiveFrom}{rateCard.effectiveTo ? ` — ${rateCard.effectiveTo}` : " — ongoing"}
          </p>
        </div>
        <Badge variant={rateCard.isActive ? "default" : "secondary"}>
          {rateCard.isActive ? "Active" : "Inactive"}
        </Badge>
        {can("manage:pricing") && (
          <Button variant="outline" onClick={handleToggleActive}>
            {rateCard.isActive ? "Deactivate" : "Activate"}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Rate Entries</CardTitle>
            <CardDescription>Negotiated rates for this customer. These override standard material prices.</CardDescription>
          </div>
          {can("manage:pricing") && (
            <Button size="sm" onClick={() => setShowAddEntry(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Entry
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {rateCard.entries.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No entries yet. Add rate entries to define customer-specific pricing.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Rate Type</TableHead>
                  <TableHead className="text-right">Unit Rate</TableHead>
                  <TableHead>Description</TableHead>
                  {can("manage:pricing") && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rateCard.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {PRICING_CATEGORIES.find((c) => c.value === entry.category)?.label ?? entry.category}
                      </Badge>
                    </TableCell>
                    <TableCell>{RATE_TYPES.find((r) => r.value === entry.rateType)?.label ?? entry.rateType}</TableCell>
                    <TableCell className="text-right font-mono">${parseFloat(entry.unitRate).toFixed(2)}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.description ?? "—"}</TableCell>
                    {can("manage:pricing") && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteEntry(entry.id)}>
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

      {rateCard.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{rateCard.notes}</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={showAddEntry} onOpenChange={setShowAddEntry}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Rate Entry</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newEntry.category} onValueChange={(v) => setNewEntry((p) => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {PRICING_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rate Type</Label>
              <Select value={newEntry.rateType} onValueChange={(v) => setNewEntry((p) => ({ ...p, rateType: v }))}>
                <SelectTrigger><SelectValue placeholder="Select rate type" /></SelectTrigger>
                <SelectContent>
                  {RATE_TYPES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unit Rate ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={newEntry.unitRate}
                onChange={(e) => setNewEntry((p) => ({ ...p, unitRate: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={newEntry.description}
                onChange={(e) => setNewEntry((p) => ({ ...p, description: e.target.value }))}
                placeholder="e.g. Clean fill delivery rate"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEntry(false)}>Cancel</Button>
            <Button onClick={handleAddEntry} disabled={createEntry.isPending}>
              {createEntry.isPending ? "Adding..." : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
