import { useState, type FormEvent } from "react";
import { useNavigate, Link, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useCreateAddress } from "@frontend/api/addresses.js";
import { useRegions } from "@frontend/api/regions.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Textarea } from "@frontend/components/ui/textarea.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select.js";
import { toast } from "sonner";

const AUSTRALIAN_STATES = ["QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT"] as const;

const ADDRESS_TYPES = [
  { value: "office", label: "Office" },
  { value: "job_site", label: "Job Site" },
  { value: "quarry", label: "Quarry" },
  { value: "depot", label: "Depot" },
  { value: "disposal_site", label: "Disposal Site" },
  { value: "storage", label: "Storage" },
] as const;

export function CreateAddressPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const createAddress = useCreateAddress();
  const { data: regionsData } = useRegions({ active: true });

  const prefilledCompanyId = searchParams.get("companyId") ?? undefined;

  const [streetAddress, setStreetAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [state, setState] = useState<string>("QLD");
  const [postcode, setPostcode] = useState("");
  const [regionId, setRegionId] = useState<string>("");
  const [types, setTypes] = useState<string[]>(["job_site"]);
  const [operatingHours, setOperatingHours] = useState("");
  const [accessConditions, setAccessConditions] = useState("");
  const [siteNotes, setSiteNotes] = useState("");

  function toggleType(type: string): void {
    setTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    if (types.length === 0) {
      toast.error("Select at least one address type");
      return;
    }

    createAddress.mutate(
      {
        streetAddress,
        suburb,
        state,
        postcode,
        regionId: regionId || undefined,
        types,
        operatingHours: operatingHours || undefined,
        accessConditions: accessConditions || undefined,
        siteNotes: siteNotes || undefined,
        companyId: prefilledCompanyId,
      },
      {
        onSuccess: () => {
          toast.success("Address created");
          void navigate("/addresses");
        },
        onError: () => toast.error("Failed to create address"),
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/addresses">
            <ArrowLeft className="h-4 w-4" />
            Back to addresses
          </Link>
        </Button>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-8 py-6">
          <h2 className="text-lg font-semibold">Add Address</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a new site, depot, quarry, or office location.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-8 py-6">
            <div className="space-y-2">
              <Label htmlFor="streetAddress">Street address</Label>
              <Input
                id="streetAddress"
                className="h-11"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="123 Main Street"
                required
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="suburb">Suburb</Label>
                <Input
                  id="suburb"
                  className="h-11"
                  value={suburb}
                  onChange={(e) => setSuburb(e.target.value)}
                  placeholder="Toowoomba"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUSTRALIAN_STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  className="h-11"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  placeholder="4350"
                  maxLength={4}
                  pattern="\d{4}"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Select value={regionId} onValueChange={setRegionId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select a region (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {regionsData?.data.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Address types</Label>
              <p className="text-xs text-muted-foreground">
                Select at least one type for this address.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {ADDRESS_TYPES.map((at) => (
                  <Button
                    key={at.value}
                    type="button"
                    variant={types.includes(at.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleType(at.value)}
                  >
                    {at.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="operatingHours">Operating hours</Label>
              <Input
                id="operatingHours"
                className="h-11"
                value={operatingHours}
                onChange={(e) => setOperatingHours(e.target.value)}
                placeholder="e.g. Mon-Fri 6am-5pm, Sat 7am-12pm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accessConditions">Access conditions</Label>
              <Textarea
                id="accessConditions"
                value={accessConditions}
                onChange={(e) => setAccessConditions(e.target.value)}
                placeholder="e.g. No B-doubles, wet weather restrictions, must check in at weighbridge"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="siteNotes">Site notes</Label>
              <Textarea
                id="siteNotes"
                value={siteNotes}
                onChange={(e) => setSiteNotes(e.target.value)}
                placeholder="Internal notes about this site..."
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t px-8 py-5">
            <Button variant="outline" asChild>
              <Link to="/addresses">Cancel</Link>
            </Button>
            <Button type="submit" disabled={createAddress.isPending}>
              {createAddress.isPending ? "Creating..." : "Create Address"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
