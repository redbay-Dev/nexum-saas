import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useContact, useUpdateContact, useDeleteContact } from "@frontend/api/contacts.js";
import { useAuth } from "@frontend/hooks/use-auth.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { toast } from "sonner";

export function ContactDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: contact, isPending, error } = useContact(id ?? "");
  const updateContact = useUpdateContact(id ?? "");
  const deleteContact = useDeleteContact();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [preferredContactMethod, setPreferredContactMethod] = useState<"phone" | "email" | "sms">("email");
  const [smsOptIn, setSmsOptIn] = useState(false);

  useEffect(() => {
    if (contact) {
      setFirstName(contact.firstName);
      setLastName(contact.lastName);
      setTitle(contact.title ?? "");
      setPhone(contact.phone ?? "");
      setEmail(contact.email ?? "");
      setPreferredContactMethod(
        contact.preferredContactMethod as "phone" | "email" | "sms",
      );
      setSmsOptIn(contact.smsOptIn);
    }
  }, [contact]);

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    updateContact.mutate(
      {
        firstName,
        lastName,
        title: title || undefined,
        phone: phone || undefined,
        email: email || undefined,
        preferredContactMethod,
        smsOptIn,
      },
      {
        onSuccess: () => toast.success("Contact updated"),
        onError: () => toast.error("Failed to update contact"),
      },
    );
  }

  function handleDelete(): void {
    if (!contact) return;
    if (!confirm(`Are you sure you want to delete "${contact.firstName} ${contact.lastName}"?`))
      return;
    deleteContact.mutate(contact.id, {
      onSuccess: () => {
        toast.success("Contact deleted");
        void navigate("/contacts");
      },
      onError: () => toast.error("Failed to delete contact"),
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

  if (error || !contact) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          Contact not found.{" "}
          <Link to="/contacts" className="underline">
            Back to contacts
          </Link>
        </div>
      </div>
    );
  }

  const canEdit = can("manage:contacts");

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/contacts">
            <ArrowLeft className="h-4 w-4" />
            Back to contacts
          </Link>
        </Button>
        <Badge variant={contact.status === "active" ? "default" : "secondary"}>
          {contact.status}
        </Badge>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-8 py-6">
          <h2 className="text-lg font-semibold">
            {contact.firstName} {contact.lastName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {contact.title ? `${contact.title} · ` : ""}
            Created {new Date(contact.createdAt).toLocaleDateString("en-AU")}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-8 py-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" className="h-11" value={firstName} onChange={(e) => setFirstName(e.target.value)} required disabled={!canEdit} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" className="h-11" value={lastName} onChange={(e) => setLastName(e.target.value)} required disabled={!canEdit} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title / Role</Label>
              <Input id="title" className="h-11" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
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
              <Label>Preferred contact method</Label>
              <div className="flex gap-2 pt-1">
                {(["email", "phone", "sms"] as const).map((method) => (
                  <Button
                    key={method}
                    type="button"
                    variant={preferredContactMethod === method ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreferredContactMethod(method)}
                    disabled={!canEdit}
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
                disabled={!canEdit}
              />
              <Label htmlFor="smsOptIn" className="font-normal">
                Opted in for SMS notifications
              </Label>
            </div>
          </div>

          {canEdit ? (
            <div className="flex justify-between border-t px-8 py-5">
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleteContact.isPending}>
                Delete
              </Button>
              <Button type="submit" disabled={updateContact.isPending}>
                {updateContact.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
