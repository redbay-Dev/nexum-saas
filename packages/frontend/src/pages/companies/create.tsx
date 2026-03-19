import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useCreateCompany } from "@frontend/api/companies.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Textarea } from "@frontend/components/ui/textarea.js";
import { toast } from "sonner";

export function CreateCompanyPage(): React.JSX.Element {
  const navigate = useNavigate();
  const createCompany = useCreateCompany();

  const [name, setName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [abn, setAbn] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [roles, setRoles] = useState<string[]>(["customer"]);

  function toggleRole(role: string): void {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    if (roles.length === 0) {
      toast.error("Select at least one role");
      return;
    }

    createCompany.mutate(
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
        onSuccess: () => {
          toast.success(`Created "${name}"`);
          void navigate("/companies");
        },
        onError: () => toast.error("Failed to create company"),
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/companies">
            <ArrowLeft className="h-4 w-4" />
            Back to companies
          </Link>
        </Button>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-8 py-6">
          <h2 className="text-lg font-semibold">Add Company</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a new customer, contractor, or supplier.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-8 py-6">
            <div className="space-y-2">
              <Label htmlFor="name">Company name</Label>
              <Input
                id="name"
                className="h-11"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Boral Construction Materials"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tradingName">Trading name</Label>
              <Input
                id="tradingName"
                className="h-11"
                value={tradingName}
                onChange={(e) => setTradingName(e.target.value)}
                placeholder="e.g. Boral"
              />
              <p className="text-xs text-muted-foreground">
                Optional. Leave blank if same as company name.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="abn">ABN</Label>
              <Input
                id="abn"
                className="h-11"
                value={abn}
                onChange={(e) => setAbn(e.target.value)}
                placeholder="11 digits"
                maxLength={11}
                pattern="\d{11}"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  className="h-11"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+61732001234"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  className="h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="orders@company.com.au"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Roles</Label>
              <p className="text-xs text-muted-foreground">
                Select at least one role for this company.
              </p>
              <div className="flex gap-2 pt-1">
                {(["customer", "contractor", "supplier"] as const).map((role) => (
                  <Button
                    key={role}
                    type="button"
                    variant={roles.includes(role) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleRole(role)}
                  >
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes about this company..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t px-8 py-5">
            <Button variant="outline" asChild>
              <Link to="/companies">Cancel</Link>
            </Button>
            <Button type="submit" disabled={createCompany.isPending}>
              {createCompany.isPending ? "Creating..." : "Create Company"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
