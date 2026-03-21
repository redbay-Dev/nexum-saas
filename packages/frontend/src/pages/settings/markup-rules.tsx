import { useState } from "react";
import { useMarkupRules, useCreateMarkupRule, useDeleteMarkupRule, useTestMarkupRule } from "@frontend/api/markup-rules.js";
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
import { Trash2, Plus, FlaskConical } from "lucide-react";
import { useAuth } from "@frontend/hooks/use-auth.js";

export function MarkupRulesSettingsPage(): React.JSX.Element {
  const { can } = useAuth();
  const { data: rules, isLoading } = useMarkupRules();
  const createRule = useCreateMarkupRule();
  const deleteRule = useDeleteMarkupRule();
  const testRule = useTestMarkupRule();
  const [showCreate, setShowCreate] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [newRule, setNewRule] = useState({ name: "", type: "percentage", markupPercentage: "", markupFixedAmount: "", priority: "100" });
  const [testInput, setTestInput] = useState({ unitRate: "", quantity: "1" });

  function handleCreate(): void {
    if (!newRule.name || !newRule.type) {
      toast.error("Name and type are required");
      return;
    }
    createRule.mutate(
      {
        name: newRule.name,
        type: newRule.type,
        markupPercentage: newRule.type === "percentage" ? parseFloat(newRule.markupPercentage) || undefined : undefined,
        markupFixedAmount: newRule.type === "fixed" ? parseFloat(newRule.markupFixedAmount) || undefined : undefined,
        priority: parseInt(newRule.priority, 10) || 100,
      },
      {
        onSuccess: () => {
          toast.success("Markup rule created");
          setShowCreate(false);
          setNewRule({ name: "", type: "percentage", markupPercentage: "", markupFixedAmount: "", priority: "100" });
        },
        onError: () => toast.error("Failed to create rule"),
      },
    );
  }

  function handleDelete(id: string, name: string): void {
    if (!confirm(`Delete markup rule "${name}"?`)) return;
    deleteRule.mutate(id, {
      onSuccess: () => toast.success("Rule deleted"),
      onError: () => toast.error("Failed to delete rule"),
    });
  }

  function handleTest(): void {
    if (!testInput.unitRate) {
      toast.error("Enter a unit rate");
      return;
    }
    testRule.mutate({ unitRate: parseFloat(testInput.unitRate), quantity: parseFloat(testInput.quantity) || 1 });
  }

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Markup Rules</h2>
          <p className="text-muted-foreground">Auto-generate revenue lines from cost lines based on configurable rules.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTest(true)}>
            <FlaskConical className="mr-2 h-4 w-4" />Test Rule
          </Button>
          {can("manage:pricing") && (
            <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />New Rule</Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Rules</CardTitle>
          <CardDescription>Rules are evaluated by priority (lowest number first). The first matching rule applies.</CardDescription>
        </CardHeader>
        <CardContent>
          {!rules || rules.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No markup rules configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Priority</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Status</TableHead>
                  {can("manage:pricing") && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-mono text-sm">{rule.priority}</TableCell>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.type === "percentage" ? "%" : "$"}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {rule.type === "percentage" && rule.markupPercentage
                        ? `${parseFloat(rule.markupPercentage)}%`
                        : rule.markupFixedAmount
                          ? `$${parseFloat(rule.markupFixedAmount).toFixed(2)}`
                          : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.isActive ? "default" : "secondary"}>
                        {rule.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {can("manage:pricing") && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id, rule.name)}>
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
          <DialogHeader><DialogTitle>New Markup Rule</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={newRule.name} onChange={(e) => setNewRule((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Standard 20% Markup" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newRule.type} onValueChange={(v) => setNewRule((p) => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newRule.type === "percentage" ? (
              <div className="space-y-2">
                <Label>Markup Percentage (%)</Label>
                <Input type="number" step="0.01" value={newRule.markupPercentage} onChange={(e) => setNewRule((p) => ({ ...p, markupPercentage: e.target.value }))} placeholder="20" />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Markup Amount ($)</Label>
                <Input type="number" step="0.01" value={newRule.markupFixedAmount} onChange={(e) => setNewRule((p) => ({ ...p, markupFixedAmount: e.target.value }))} placeholder="5.00" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Priority (lower = higher priority)</Label>
              <Input type="number" min="0" value={newRule.priority} onChange={(e) => setNewRule((p) => ({ ...p, priority: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createRule.isPending}>{createRule.isPending ? "Creating..." : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTest} onOpenChange={setShowTest}>
        <DialogContent>
          <DialogHeader><DialogTitle>Test Markup Rules</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-sm text-muted-foreground">Enter a cost scenario to see which rule matches and what the revenue line would be.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cost Unit Rate ($)</Label>
                <Input type="number" step="0.01" value={testInput.unitRate} onChange={(e) => setTestInput((p) => ({ ...p, unitRate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" value={testInput.quantity} onChange={(e) => setTestInput((p) => ({ ...p, quantity: e.target.value }))} />
              </div>
            </div>
            <Button onClick={handleTest} disabled={testRule.isPending}>{testRule.isPending ? "Testing..." : "Test"}</Button>
            {testRule.data && (
              <Card className="mt-2">
                <CardContent className="pt-4">
                  {testRule.data.matched ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Matched: {testRule.data.rule?.name}</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-muted-foreground">Cost:</span>
                        <span className="font-mono">${testRule.data.result?.costTotal.toFixed(2)}</span>
                        <span className="text-muted-foreground">Revenue:</span>
                        <span className="font-mono">${testRule.data.result?.revenueTotal.toFixed(2)}</span>
                        <span className="text-muted-foreground">Margin:</span>
                        <span className="font-mono">{testRule.data.result?.marginPercent.toFixed(1)}%</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No matching rule found for this scenario.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
