import { useState } from "react";
import { useMarginThresholds, useCreateMarginThreshold, useDeleteMarginThreshold } from "@frontend/api/margin-thresholds.js";
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

const LEVEL_LABELS: Record<string, string> = {
  global: "Global",
  category: "Per Category",
  customer: "Per Customer",
  material_type: "Per Material Type",
};

export function MarginThresholdsSettingsPage(): React.JSX.Element {
  const { can } = useAuth();
  const { data: thresholds, isLoading } = useMarginThresholds();
  const createThreshold = useCreateMarginThreshold();
  const deleteThreshold = useDeleteMarginThreshold();
  const [showCreate, setShowCreate] = useState(false);
  const [newThreshold, setNewThreshold] = useState({
    level: "global",
    minimumMarginPercent: "",
    warningMarginPercent: "",
    requiresApproval: false,
  });

  function handleCreate(): void {
    if (!newThreshold.minimumMarginPercent || !newThreshold.warningMarginPercent) {
      toast.error("Both margin thresholds are required");
      return;
    }
    createThreshold.mutate(
      {
        level: newThreshold.level,
        minimumMarginPercent: parseFloat(newThreshold.minimumMarginPercent),
        warningMarginPercent: parseFloat(newThreshold.warningMarginPercent),
        requiresApproval: newThreshold.requiresApproval,
      },
      {
        onSuccess: () => {
          toast.success("Threshold created");
          setShowCreate(false);
          setNewThreshold({ level: "global", minimumMarginPercent: "", warningMarginPercent: "", requiresApproval: false });
        },
        onError: () => toast.error("Failed to create threshold"),
      },
    );
  }

  function handleDelete(id: string): void {
    if (!confirm("Delete this margin threshold?")) return;
    deleteThreshold.mutate(id, {
      onSuccess: () => toast.success("Threshold deleted"),
      onError: () => toast.error("Failed to delete threshold"),
    });
  }

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Margin Thresholds</h2>
          <p className="text-muted-foreground">Set minimum margin requirements. Most specific level wins (material type &gt; customer &gt; category &gt; global).</p>
        </div>
        {can("manage:pricing") && (
          <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />New Threshold</Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured Thresholds</CardTitle>
          <CardDescription>When a pricing line&apos;s margin falls below the threshold, a warning or approval requirement is triggered.</CardDescription>
        </CardHeader>
        <CardContent>
          {!thresholds || thresholds.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No margin thresholds configured. Pricing lines will not be validated against margin requirements.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-right">Minimum %</TableHead>
                  <TableHead className="text-right">Warning %</TableHead>
                  <TableHead>Approval Required</TableHead>
                  <TableHead>Status</TableHead>
                  {can("manage:pricing") && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {thresholds.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Badge variant="outline">{LEVEL_LABELS[t.level] ?? t.level}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600">{parseFloat(t.minimumMarginPercent).toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono text-amber-600">{parseFloat(t.warningMarginPercent).toFixed(1)}%</TableCell>
                    <TableCell>{t.requiresApproval ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <Badge variant={t.isActive ? "default" : "secondary"}>
                        {t.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {can("manage:pricing") && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
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
        <DialogContent>
          <DialogHeader><DialogTitle>New Margin Threshold</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Level</Label>
              <Select value={newThreshold.level} onValueChange={(v) => setNewThreshold((p) => ({ ...p, level: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (all pricing)</SelectItem>
                  <SelectItem value="category">Per Pricing Category</SelectItem>
                  <SelectItem value="customer">Per Customer</SelectItem>
                  <SelectItem value="material_type">Per Material Type</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Minimum Margin (%)</Label>
                <Input type="number" step="0.1" value={newThreshold.minimumMarginPercent} onChange={(e) => setNewThreshold((p) => ({ ...p, minimumMarginPercent: e.target.value }))} placeholder="10" />
                <p className="text-xs text-muted-foreground">Below this triggers a block or warning</p>
              </div>
              <div className="space-y-2">
                <Label>Warning Margin (%)</Label>
                <Input type="number" step="0.1" value={newThreshold.warningMarginPercent} onChange={(e) => setNewThreshold((p) => ({ ...p, warningMarginPercent: e.target.value }))} placeholder="15" />
                <p className="text-xs text-muted-foreground">Below this shows a yellow warning</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="requires-approval"
                checked={newThreshold.requiresApproval}
                onChange={(e) => setNewThreshold((p) => ({ ...p, requiresApproval: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="requires-approval">Require approval when below minimum</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createThreshold.isPending}>{createThreshold.isPending ? "Creating..." : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
