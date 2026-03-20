import { useState, type FormEvent } from "react";
import { useNavigate, Link, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useCreateContact } from "@frontend/api/contacts.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { toast } from "sonner";

export function CreateContactPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const createContact = useCreateContact();

  // Pre-populate company/address from query params (when adding from a detail page)
  const prefilledCompanyId = searchParams.get("companyId") ?? undefined;
  const prefilledAddressId = searchParams.get("addressId") ?? undefined;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [preferredContactMethod, setPreferredContactMethod] = useState<"phone" | "email" | "sms">("email");
  const [smsOptIn, setSmsOptIn] = useState(false);

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();

    if (!prefilledCompanyId && !prefilledAddressId) {
      toast.error("Contact must be linked to a company or address");
      return;
    }

    createContact.mutate(
      {
        firstName,
        lastName,
        title: title || undefined,
        phone: phone || undefined,
        email: email || undefined,
        companyId: prefilledCompanyId,
        addressId: prefilledAddressId,
        preferredContactMethod,
        smsOptIn,
      },
      {
        onSuccess: () => {
          toast.success(`Created "${firstName} ${lastName}"`);
          void navigate("/contacts");
        },
        onError: () => toast.error("Failed to create contact"),
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/contacts">
            <ArrowLeft className="h-4 w-4" />
            Back to contacts
          </Link>
        </Button>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-8 py-6">
          <h2 className="text-lg font-semibold">Add Contact</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a new contact for a company or site.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-8 py-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  className="h-11"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  className="h-11"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title / Role</Label>
              <Input
                id="title"
                className="h-11"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Site Manager, Accounts Payable"
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
                  placeholder="+61412345678"
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
                  placeholder="john@company.com.au"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Preferred contact method</Label>
              <div className="flex gap-2 pt-1">
                {(["email", "phone", "sms"] as const).map((method) => (
                  <Button
                    key={method}
                    type="button"
                    variant={preferredContactMethod === method ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreferredContactMethod(method)}
                  >
                    {method.charAt(0).toUpperCase() + method.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="smsOptIn"
                checked={smsOptIn}
                onChange={(e) => setSmsOptIn(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="smsOptIn" className="font-normal">
                Opted in for SMS notifications
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t px-8 py-5">
            <Button variant="outline" asChild>
              <Link to="/contacts">Cancel</Link>
            </Button>
            <Button type="submit" disabled={createContact.isPending}>
              {createContact.isPending ? "Creating..." : "Create Contact"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
