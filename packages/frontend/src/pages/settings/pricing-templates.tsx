import { useState } from "react";
import { usePricingTemplates, useCreatePricingTemplate, useDeletePricingTemplate } from "@frontend/api/pricing-templates.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@frontend/components/ui/card.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@frontend/components/ui/dialog.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { Trash2, Plus, Copy } from "lucide-react";
import { useAuth } from "@frontend/hooks/use-auth.js";

export function PricingTemplatesSettingsPage(): React.JSX.Element {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { data: templates, isLoading } = usePricingTemplates();
  const createTemplate = useCreatePricingTemplate();
  const deleteTemplate = useDeletePricingTemplate();
  const [showCreate, setShowCreate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", description: "" });

  function handleCreate(): void {
    if (!newTemplate.name) {
      toast.error("Template name is required");
      return;
    }
    createTemplate.mutate(
      { name: newTemplate.name, description: newTemplate.description || undefined },
      {
        onSuccess: (tmpl) => {
          toast.success("Template created");
          setShowCreate(false);
          setNewTemplate({ name: "", description: "" });
          void navigate(`/settings/pricing-templates/${tmpl.id}`);
        },
        onError: () => toast.error("Failed to create template"),
      },
    );
  }

  function handleDelete(id: string, name: string): void {
    if (!confirm(`Delete template "${name}"?`)) return;
    deleteTemplate.mutate(id, {
      onSuccess: () => toast.success("Template deleted"),
      onError: () => toast.error("Failed to delete template"),
    });
  }

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pricing Templates</h2>
          <p className="text-muted-foreground">Reusable pricing line sets for recurring job scenarios. Apply to any job with one click.</p>
        </div>
        {can("manage:pricing") && (
          <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />New Template</Button>
        )}
      </div>

      {!templates || templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Copy className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">No pricing templates yet. Create one to save time on recurring pricing setups.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((tmpl) => (
            <Card key={tmpl.id} className="cursor-pointer hover:bg-muted/50" onClick={() => void navigate(`/settings/pricing-templates/${tmpl.id}`)}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base">{tmpl.name}</CardTitle>
                  {tmpl.description && <CardDescription>{tmpl.description}</CardDescription>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={tmpl.isActive ? "default" : "secondary"}>
                    {tmpl.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {can("manage:pricing") && (
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(tmpl.id, tmpl.name); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Pricing Template</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input value={newTemplate.name} onChange={(e) => setNewTemplate((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Standard Quarry Run" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input value={newTemplate.description} onChange={(e) => setNewTemplate((p) => ({ ...p, description: e.target.value }))} placeholder="Default pricing for quarry deliveries" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createTemplate.isPending}>{createTemplate.isPending ? "Creating..." : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
