import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useCompany, useUpdateCompany, useDeleteCompany } from "@frontend/api/companies.js";
import { useAuth } from "@frontend/hooks/use-auth.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Textarea } from "@frontend/components/ui/textarea.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { toast } from "sonner";

export function CompanyDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: company, isPending, error } = useCompany(id ?? "");
  const updateCompany = useUpdateCompany(id ?? "");
  const deleteCompany = useDeleteCompany();

  const [name, setName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [abn, setAbn] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    if (company) {
      setName(company.name);
      setTradingName(company.tradingName ?? "");
      setAbn(company.abn ?? "");
      setPhone(company.phone ?? "");
      setEmail(company.email ?? "");
      setNotes(company.notes ?? "");
      const r: string[] = [];
      if (company.isCustomer) r.push("customer");
      if (company.isContractor) r.push("contractor");
      if (company.isSupplier) r.push("supplier");
      setRoles(r);
    }
  }, [company]);

  function toggleRole(role: string): void {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (roles.length === 0) {
      toast.error("Select at least one role");
      return;
    }

    updateCompany.mutate(
      {
        name,
        tradingName: tradingName || undefined,
        abn: abn || undefined,
        phone: phone || undefined,
        email: email || undefined,
        notes: notes || undefined,
        roles,
      },
      {
        onSuccess: () => toast.success("Company updated"),
        onError: () => toast.error("Failed to update company"),
      },
    );
  }

  function handleDelete(): void {
    if (!company) return;
    if (!confirm(`Are you sure you want to delete "${company.name}"?`)) return;
    deleteCompany.mutate(company.id, {
      onSuccess: () => {
        toast.success("Company deleted");
        void navigate("/companies");
      },
      onError: () => toast.error("Failed to delete company"),
    });
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          Company not found.{" "}
          <Link to="/companies" className="underline">
            Back to companies
          </Link>
        </div>
      </div>
    );
  }

  const canEdit = can("manage:companies");

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/companies">
            <ArrowLeft className="h-4 w-4" />
            Back to companies
          </Link>
        </Button>
        <Badge variant={company.status === "active" ? "default" : "secondary"}>
          {company.status}
        </Badge>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-8 py-6">
          <h2 className="text-lg font-semibold">{company.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {company.tradingName ? `t/a ${company.tradingName} · ` : ""}
            Created {new Date(company.createdAt).toLocaleDateString("en-AU")}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-8 py-6">
            <div className="space-y-2">
              <Label htmlFor="name">Company name</Label>
              <Input id="name" className="h-11" value={name} onChange={(e) => setName(e.target.value)} required disabled={!canEdit} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tradingName">Trading name</Label>
              <Input id="tradingName" className="h-11" value={tradingName} onChange={(e) => setTradingName(e.target.value)} disabled={!canEdit} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="abn">ABN</Label>
              <Input id="abn" className="h-11" value={abn} onChange={(e) => setAbn(e.target.value)} maxLength={11} pattern="\d{11}" disabled={!canEdit} />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" className="h-11" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canEdit} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!canEdit} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="flex gap-2 pt-1">
                {(["customer", "contractor", "supplier"] as const).map((role) => (
                  <Button
                    key={role}
                    type="button"
                    variant={roles.includes(role) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleRole(role)}
                    disabled={!canEdit}
                  >
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} disabled={!canEdit} />
            </div>
          </div>

          {canEdit ? (
            <div className="flex justify-between border-t px-8 py-5">
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleteCompany.isPending}>
                Delete
              </Button>
              <Button type="submit" disabled={updateCompany.isPending}>
                {updateCompany.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
