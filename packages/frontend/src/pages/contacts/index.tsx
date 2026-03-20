import { useState } from "react";
import { Link } from "react-router";
import { Plus, Search, UserRound } from "lucide-react";
import { useContacts, useDeleteContact } from "@frontend/api/contacts.js";
import { useAuth } from "@frontend/hooks/use-auth.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Badge } from "@frontend/components/ui/badge.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/components/ui/table.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { toast } from "sonner";

type StatusFilter = "all" | "active" | "inactive";

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export function ContactsPage(): React.JSX.Element {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const deleteContact = useDeleteContact();

  const { data, isPending, error } = useContacts({
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  function handleDelete(id: string, name: string): void {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    deleteContact.mutate(id, {
      onSuccess: () => toast.success(`Deleted "${name}"`),
      onError: () => toast.error("Failed to delete contact"),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Contacts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            People associated with your companies and sites.
          </p>
        </div>
        {can("manage:contacts") ? (
          <Button asChild>
            <Link to="/contacts/new">
              <Plus className="h-4 w-4" />
              Add Contact
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <form className="relative w-full max-w-sm" onSubmit={(e) => e.preventDefault()}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9"
            />
          </form>
          <div className="flex gap-1">
            {STATUS_TABS.map((tab) => (
              <Button
                key={tab.value}
                variant={statusFilter === tab.value ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter(tab.value)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="border-t">
          {isPending ? (
            <div className="space-y-1 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-10 text-center text-destructive">
              Failed to load contacts. Please try again.
            </div>
          ) : data?.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
                <UserRound className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">No contacts yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add contacts for your companies and sites.
                </p>
              </div>
              {can("manage:contacts") ? (
                <Button size="sm" asChild>
                  <Link to="/contacts/new">
                    <Plus className="h-4 w-4" />
                    Add Contact
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Preferred</TableHead>
                  <TableHead>Status</TableHead>
                  {can("manage:contacts") ? <TableHead className="w-[100px]" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <Link
                        to={`/contacts/${contact.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {contact.firstName} {contact.lastName}
                      </Link>
                      {contact.title ? (
                        <p className="text-xs text-muted-foreground">{contact.title}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {contact.email ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {contact.phone ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{contact.preferredContactMethod}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={contact.status === "active" ? "default" : "secondary"}>
                        {contact.status}
                      </Badge>
                    </TableCell>
                    {can("manage:contacts") ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/contacts/${contact.id}`}>Edit</Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                              handleDelete(
                                contact.id,
                                `${contact.firstName} ${contact.lastName}`,
                              )
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {data && data.data.length > 0 ? (
          <div className="border-t px-6 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {data.data.length} of {data.total ?? data.data.length} contacts
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
