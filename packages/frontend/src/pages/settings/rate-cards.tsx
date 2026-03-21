import { useState } from "react";
import { useRateCards, useCreateRateCard, useDeleteRateCard } from "@frontend/api/rate-cards.js";
import { useCompanies, type Company } from "@frontend/api/companies.js";
import { Card, CardContent, CardHeader, CardTitle } from "@frontend/components/ui/card.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@frontend/components/ui/select.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@frontend/components/ui/dialog.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { Trash2, Plus, FileText } from "lucide-react";
import { useAuth } from "@frontend/hooks/use-auth.js";

export function RateCardsSettingsPage(): React.JSX.Element {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { data: rateCards, isLoading } = useRateCards();
  const { data: companiesData } = useCompanies({ role: "customer", limit: 100 });
  const createRateCard = useCreateRateCard();
  const deleteRateCard = useDeleteRateCard();
  const [showCreate, setShowCreate] = useState(false);
  const [newCard, setNewCard] = useState({
    customerId: "",
    name: "",
    effectiveFrom: "",
    effectiveTo: "",
  });

  const customers: Company[] = companiesData?.data ?? [];

  function handleCreate(): void {
    if (!newCard.customerId || !newCard.name || !newCard.effectiveFrom) {
      toast.error("Customer, name, and effective from date are required");
      return;
    }
    createRateCard.mutate(
      {
        customerId: newCard.customerId,
        name: newCard.name,
        effectiveFrom: newCard.effectiveFrom,
        effectiveTo: newCard.effectiveTo || undefined,
      },
      {
        onSuccess: (card) => {
          toast.success("Rate card created");
          setShowCreate(false);
          setNewCard({ customerId: "", name: "", effectiveFrom: "", effectiveTo: "" });
          void navigate(`/settings/rate-cards/${card.id}`);
        },
        onError: () => toast.error("Failed to create rate card"),
      },
    );
  }

  function handleDelete(id: string, name: string): void {
    if (!confirm(`Delete rate card "${name}"?`)) return;
    deleteRateCard.mutate(id, {
      onSuccess: () => toast.success("Rate card deleted"),
      onError: () => toast.error("Failed to delete rate card"),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Customer Rate Cards</h2>
          <p className="text-muted-foreground">Negotiated pricing per customer with effective date ranges.</p>
        </div>
        {can("manage:pricing") && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Rate Card
          </Button>
        )}
      </div>

      {!rateCards || rateCards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">No rate cards yet. Create one to set customer-specific pricing.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rateCards.map((card) => {
            const customer = customers.find((c: Company) => c.id === card.customerId);
            return (
              <Card key={card.id} className="cursor-pointer hover:bg-muted/50" onClick={() => void navigate(`/settings/rate-cards/${card.id}`)}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-base">{card.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {customer?.name ?? "Unknown customer"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={card.isActive ? "default" : "secondary"}>
                      {card.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {card.effectiveFrom}{card.effectiveTo ? ` — ${card.effectiveTo}` : " — ongoing"}
                    </span>
                    {can("manage:pricing") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(card.id, card.name);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Rate Card</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={newCard.customerId} onValueChange={(v) => setNewCard((p) => ({ ...p, customerId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c: Company) => (
                    <SelectItem key={c.id as string} value={c.id as string}>{c.name as string}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rate Card Name</Label>
              <Input value={newCard.name} onChange={(e) => setNewCard((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Standard Rates 2026" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Effective From</Label>
                <Input type="date" value={newCard.effectiveFrom} onChange={(e) => setNewCard((p) => ({ ...p, effectiveFrom: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Effective To (optional)</Label>
                <Input type="date" value={newCard.effectiveTo} onChange={(e) => setNewCard((p) => ({ ...p, effectiveTo: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createRateCard.isPending}>
              {createRateCard.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
