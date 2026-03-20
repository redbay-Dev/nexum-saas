import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { ArrowLeft, DoorOpen, UserRound, X } from "lucide-react";
import {
  useAddress,
  useUpdateAddress,
  useDeleteAddress,
  useDeleteEntryPoint,
  useCreateEntryPoint,
} from "@frontend/api/addresses.js";
import type { EntryPoint } from "@frontend/api/addresses.js";
import { useAuth } from "@frontend/hooks/use-auth.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Textarea } from "@frontend/components/ui/textarea.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { toast } from "sonner";

const ADDRESS_TYPES = [
  { value: "office", label: "Office" },
  { value: "job_site", label: "Job Site" },
  { value: "quarry", label: "Quarry" },
  { value: "depot", label: "Depot" },
  { value: "disposal_site", label: "Disposal Site" },
  { value: "storage", label: "Storage" },
] as const;

const TYPE_LABELS: Record<string, string> = {
  office: "Office",
  job_site: "Job Site",
  quarry: "Quarry",
  depot: "Depot",
  disposal_site: "Disposal",
  storage: "Storage",
};

export function AddressDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: address, isPending, error } = useAddress(id ?? "");
  const updateAddress = useUpdateAddress(id ?? "");
  const deleteAddress = useDeleteAddress();
  const deleteEntryPoint = useDeleteEntryPoint(id ?? "");
  const createEntryPoint = useCreateEntryPoint();

  const [streetAddress, setStreetAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [operatingHours, setOperatingHours] = useState("");
  const [accessConditions, setAccessConditions] = useState("");
  const [siteNotes, setSiteNotes] = useState("");

  // New entry point form
  const [showEpForm, setShowEpForm] = useState(false);
  const [epName, setEpName] = useState("");
  const [epDescription, setEpDescription] = useState("");
  const [epDriverInstructions, setEpDriverInstructions] = useState("");

  useEffect(() => {
    if (address) {
      setStreetAddress(address.streetAddress);
      setSuburb(address.suburb);
      setPostcode(address.postcode);
      setTypes(address.types);
      setOperatingHours(address.operatingHours ?? "");
      setAccessConditions(address.accessConditions ?? "");
      setSiteNotes(address.siteNotes ?? "");
    }
  }, [address]);

  function toggleType(type: string): void {
    setTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (types.length === 0) {
      toast.error("Select at least one address type");
      return;
    }
    updateAddress.mutate(
      {
        streetAddress,
        suburb,
        postcode,
        types,
        operatingHours: operatingHours || undefined,
        accessConditions: accessConditions || undefined,
        siteNotes: siteNotes || undefined,
      },
      {
        onSuccess: () => toast.success("Address updated"),
        onError: () => toast.error("Failed to update address"),
      },
    );
  }

  function handleDelete(): void {
    if (!address) return;
    if (!confirm(`Are you sure you want to delete "${address.streetAddress}"?`)) return;
    deleteAddress.mutate(address.id, {
      onSuccess: () => {
        toast.success("Address deleted");
        void navigate("/addresses");
      },
      onError: () => toast.error("Failed to delete address"),
    });
  }

  function handleDeleteEntryPoint(ep: EntryPoint): void {
    if (!confirm(`Delete entry point "${ep.name}"?`)) return;
    deleteEntryPoint.mutate(ep.id, {
      onSuccess: () => toast.success(`Deleted "${ep.name}"`),
      onError: () => toast.error("Failed to delete entry point"),
    });
  }

  function handleCreateEntryPoint(e: React.FormEvent): void {
    e.preventDefault();
    if (!id) return;
    createEntryPoint.mutate(
      {
        addressId: id,
        name: epName,
        description: epDescription || undefined,
        driverInstructions: epDriverInstructions || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Created "${epName}"`);
          setEpName("");
          setEpDescription("");
          setEpDriverInstructions("");
          setShowEpForm(false);
        },
        onError: () => toast.error("Failed to create entry point"),
      },
    );
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    );
  }

  if (error || !address) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          Address not found.{" "}
          <Link to="/addresses" className="underline">
            Back to addresses
          </Link>
        </div>
      </div>
    );
  }

  const canEdit = can("manage:addresses");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/addresses">
            <ArrowLeft className="h-4 w-4" />
            Back to addresses
          </Link>
        </Button>
        <div className="flex gap-1.5">
          {address.types.map((t) => (
            <Badge key={t} variant="secondary">
              {TYPE_LABELS[t] ?? t}
            </Badge>
          ))}
        </div>
      </div>

      {/* Address Details Card */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-8 py-6">
          <h2 className="text-lg font-semibold">{address.streetAddress}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {address.suburb} {address.state} {address.postcode}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-8 py-6">
            <div className="space-y-2">
              <Label htmlFor="streetAddress">Street address</Label>
              <Input id="streetAddress" className="h-11" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} required disabled={!canEdit} />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="suburb">Suburb</Label>
                <Input id="suburb" className="h-11" value={suburb} onChange={(e) => setSuburb(e.target.value)} required disabled={!canEdit} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode</Label>
                <Input id="postcode" className="h-11" value={postcode} onChange={(e) => setPostcode(e.target.value)} maxLength={4} pattern="\d{4}" required disabled={!canEdit} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address types</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {ADDRESS_TYPES.map((at) => (
                  <Button
                    key={at.value}
                    type="button"
                    variant={types.includes(at.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleType(at.value)}
                    disabled={!canEdit}
                  >
                    {at.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="operatingHours">Operating hours</Label>
              <Input id="operatingHours" className="h-11" value={operatingHours} onChange={(e) => setOperatingHours(e.target.value)} disabled={!canEdit} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accessConditions">Access conditions</Label>
              <Textarea id="accessConditions" value={accessConditions} onChange={(e) => setAccessConditions(e.target.value)} rows={2} disabled={!canEdit} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="siteNotes">Site notes</Label>
              <Textarea id="siteNotes" value={siteNotes} onChange={(e) => setSiteNotes(e.target.value)} rows={2} disabled={!canEdit} />
            </div>
          </div>

          {canEdit ? (
            <div className="flex justify-between border-t px-8 py-5">
              <Button type="button" variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
              <Button type="submit" disabled={updateAddress.isPending}>
                {updateAddress.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          ) : null}
        </form>
      </div>

      {/* Linked Companies */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-8 py-5">
          <h3 className="font-semibold">Linked Companies</h3>
        </div>
        <div className="px-8 py-4">
          {address.companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No companies linked to this address.</p>
          ) : (
            <div className="space-y-2">
              {address.companies.map((company) => (
                <div key={company.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <Link to={`/companies/${company.id}`} className="font-medium text-primary hover:underline">
                    {company.name}
                    {company.tradingName ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        t/a {company.tradingName}
                      </span>
                    ) : null}
                  </Link>
                  <div className="flex gap-1.5">
                    {company.isCustomer ? <Badge variant="default">Customer</Badge> : null}
                    {company.isContractor ? <Badge variant="secondary">Contractor</Badge> : null}
                    {company.isSupplier ? <Badge variant="outline">Supplier</Badge> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Site Contacts */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-8 py-5">
          <h3 className="font-semibold">Site Contacts</h3>
          {canEdit ? (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/contacts/new?addressId=${address.id}`}>
                <UserRound className="h-3.5 w-3.5" />
                Add
              </Link>
            </Button>
          ) : null}
        </div>
        <div className="px-8 py-4">
          {address.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts at this site.</p>
          ) : (
            <div className="space-y-2">
              {address.contacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <Link to={`/contacts/${contact.id}`} className="font-medium text-primary hover:underline">
                      {contact.firstName} {contact.lastName}
                    </Link>
                    {contact.title ? (
                      <p className="text-xs text-muted-foreground">{contact.title}</p>
                    ) : null}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {contact.phone ?? contact.email ?? "-"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Entry Points */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-8 py-5">
          <h3 className="font-semibold">Entry Points</h3>
          {canEdit ? (
            <Button variant="outline" size="sm" onClick={() => setShowEpForm(!showEpForm)}>
              {showEpForm ? (
                <>
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </>
              ) : (
                <>
                  <DoorOpen className="h-3.5 w-3.5" />
                  Add
                </>
              )}
            </Button>
          ) : null}
        </div>

        {showEpForm ? (
          <form onSubmit={handleCreateEntryPoint} className="border-b px-8 py-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="epName">Entry point name</Label>
                <Input
                  id="epName"
                  className="h-10"
                  value={epName}
                  onChange={(e) => setEpName(e.target.value)}
                  placeholder="e.g. Gate 1 — Main road access"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="epDescription">Description</Label>
                <Input
                  id="epDescription"
                  className="h-10"
                  value={epDescription}
                  onChange={(e) => setEpDescription(e.target.value)}
                  placeholder="Short description of this entry point"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="epDriverInstructions">Driver instructions</Label>
                <Textarea
                  id="epDriverInstructions"
                  value={epDriverInstructions}
                  onChange={(e) => setEpDriverInstructions(e.target.value)}
                  placeholder="Approach from north, check in at weighbridge..."
                  rows={2}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={createEntryPoint.isPending}>
                  {createEntryPoint.isPending ? "Creating..." : "Create Entry Point"}
                </Button>
              </div>
            </div>
          </form>
        ) : null}

        <div className="px-8 py-4">
          {address.entryPoints.length === 0 && !showEpForm ? (
            <p className="text-sm text-muted-foreground">
              No entry points. Large sites often have multiple gates or access roads.
            </p>
          ) : (
            <div className="space-y-2">
              {address.entryPoints.map((ep) => (
                <div key={ep.id} className="flex items-start justify-between rounded-lg border px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ep.name}</span>
                      <Badge
                        variant={
                          ep.status === "active"
                            ? "default"
                            : ep.status === "temporarily_closed"
                              ? "destructive"
                              : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {ep.status}
                      </Badge>
                    </div>
                    {ep.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{ep.description}</p>
                    ) : null}
                    {ep.driverInstructions ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Driver: {ep.driverInstructions}
                      </p>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteEntryPoint(ep)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
