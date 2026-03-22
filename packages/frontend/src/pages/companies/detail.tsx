import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { ArrowLeft, Briefcase, FileText, Receipt, CreditCard, Package } from "lucide-react";
import { useCompany, useUpdateCompany, useDeleteCompany } from "@frontend/api/companies.js";
import { useJobs } from "@frontend/api/jobs.js";
import { useInvoices } from "@frontend/api/invoices.js";
import { useRctis } from "@frontend/api/rctis.js";
import { useAuth } from "@frontend/hooks/use-auth.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Label } from "@frontend/components/ui/label.js";
import { Textarea } from "@frontend/components/ui/textarea.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@frontend/components/ui/tabs.js";
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
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="mx-auto max-w-4xl">
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
  const activeTabs: Array<{ value: string; label: string }> = [
    { value: "profile", label: "Profile" },
  ];
  if (company.isCustomer) activeTabs.push({ value: "customer", label: "As Customer" });
  if (company.isContractor) activeTabs.push({ value: "contractor", label: "As Contractor" });
  if (company.isSupplier) activeTabs.push({ value: "supplier", label: "As Supplier" });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/companies">
            <ArrowLeft className="h-4 w-4" />
            Back to companies
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {company.isCustomer ? <Badge variant="default">Customer</Badge> : null}
          {company.isContractor ? <Badge variant="secondary">Contractor</Badge> : null}
          {company.isSupplier ? <Badge variant="outline">Supplier</Badge> : null}
          <Badge variant={company.status === "active" ? "default" : "secondary"}>
            {company.status}
          </Badge>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-8 py-6">
          <h2 className="text-lg font-semibold">{company.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {company.tradingName ? `t/a ${company.tradingName} · ` : ""}
            Created {new Date(company.createdAt).toLocaleDateString("en-AU")}
          </p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <div className="border-b px-8">
            <TabsList className="h-auto bg-transparent p-0">
              {activeTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* ── Profile Tab ── */}
          <TabsContent value="profile">
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
          </TabsContent>

          {/* ── As Customer Tab ── */}
          {company.isCustomer ? (
            <TabsContent value="customer">
              <CustomerRolePanel companyId={company.id} />
            </TabsContent>
          ) : null}

          {/* ── As Contractor Tab ── */}
          {company.isContractor ? (
            <TabsContent value="contractor">
              <ContractorRolePanel companyId={company.id} />
            </TabsContent>
          ) : null}

          {/* ── As Supplier Tab ── */}
          {company.isSupplier ? (
            <TabsContent value="supplier">
              <SupplierRolePanel companyId={company.id} />
            </TabsContent>
          ) : null}
        </Tabs>
      </div>
    </div>
  );
}

/**
 * Customer role panel — shows jobs, invoices, credit status for this customer.
 */
function CustomerRolePanel({ companyId }: { companyId: string }): React.JSX.Element {
  const { data: jobsData, isPending: jobsLoading } = useJobs({ customerId: companyId, limit: 10 });
  const { data: invoicesData, isPending: invoicesLoading } = useInvoices({ customerId: companyId, limit: 10 });

  return (
    <div className="space-y-6 px-8 py-6">
      {/* Recent Jobs */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Recent Jobs</h3>
        </div>
        {jobsLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : jobsData?.data?.length ? (
          <div className="divide-y rounded-lg border">
            {jobsData.data.slice(0, 5).map((job) => (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
              >
                <div>
                  <span className="font-medium">{job.jobNumber}</span>
                  <span className="ml-2 text-muted-foreground">{job.name}</span>
                </div>
                <Badge variant={job.status === "completed" ? "default" : "secondary"} className="text-xs">
                  {job.status}
                </Badge>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No jobs found for this customer.</p>
        )}
      </section>

      {/* Recent Invoices */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Recent Invoices</h3>
        </div>
        {invoicesLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : invoicesData?.data?.length ? (
          <div className="divide-y rounded-lg border">
            {invoicesData.data.slice(0, 5).map((inv) => (
              <Link
                key={inv.id}
                to={`/invoices/${inv.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
              >
                <div>
                  <span className="font-medium">{inv.invoiceNumber}</span>
                  <span className="ml-2 text-muted-foreground">${parseFloat(inv.total).toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
                </div>
                <Badge variant={inv.status === "paid" ? "default" : inv.status === "overdue" ? "destructive" : "secondary"} className="text-xs">
                  {inv.status}
                </Badge>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No invoices found for this customer.</p>
        )}
      </section>

      {/* Credit Status */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Credit Status</h3>
        </div>
        <div className="rounded-lg border p-4">
          <Link to={`/credit/${companyId}`} className="text-sm text-primary hover:underline">
            View credit details
          </Link>
        </div>
      </section>
    </div>
  );
}

/**
 * Contractor role panel — shows assigned work, RCTIs, payments.
 */
function ContractorRolePanel({ companyId }: { companyId: string }): React.JSX.Element {
  const { data: rctisData, isPending: rctisLoading } = useRctis({ contractorId: companyId, limit: 10 });

  return (
    <div className="space-y-6 px-8 py-6">
      {/* Recent RCTIs */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Recent RCTIs</h3>
        </div>
        {rctisLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : rctisData?.data?.length ? (
          <div className="divide-y rounded-lg border">
            {rctisData.data.slice(0, 5).map((rcti) => (
              <Link
                key={rcti.id}
                to={`/rctis/${rcti.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
              >
                <div>
                  <span className="font-medium">{rcti.rctiNumber}</span>
                  <span className="ml-2 text-muted-foreground">
                    {rcti.periodStart} — {rcti.periodEnd}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">${parseFloat(rcti.total).toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
                  <Badge variant={rcti.status === "paid" ? "default" : "secondary"} className="text-xs">
                    {rcti.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No RCTIs found for this contractor.</p>
        )}
      </section>
    </div>
  );
}

/**
 * Supplier role panel — shows materials supplied, pricing.
 */
function SupplierRolePanel({ companyId }: { companyId: string }): React.JSX.Element {
  return (
    <div className="space-y-6 px-8 py-6">
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Materials Supplied</h3>
        </div>
        <div className="rounded-lg border p-4">
          <Link to={`/materials?supplierId=${companyId}`} className="text-sm text-primary hover:underline">
            View materials from this supplier
          </Link>
        </div>
      </section>
    </div>
  );
}
