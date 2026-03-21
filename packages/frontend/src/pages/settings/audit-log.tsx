import { useState } from "react";
import { useAuditLog } from "@frontend/api/audit-log.js";
import type { AuditLogFilters } from "@frontend/api/audit-log.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@frontend/components/ui/card.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@frontend/components/ui/table.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@frontend/components/ui/select.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { AUDIT_ACTIONS } from "@nexum/shared";

const ACTION_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  CREATE: "default",
  UPDATE: "secondary",
  DELETE: "destructive",
  STATUS_CHANGE: "outline",
  RESTORE: "default",
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditLogPage(): React.JSX.Element {
  const [filters, setFilters] = useState<AuditLogFilters>({ limit: 50 });
  const { data, isLoading } = useAuditLog(filters);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  function updateFilter(key: keyof AuditLogFilters, value: string): void {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
      cursor: undefined, // Reset pagination on filter change
    }));
  }

  function loadMore(): void {
    if (data?.nextCursor) {
      setFilters((prev) => ({ ...prev, cursor: data.nextCursor ?? undefined }));
    }
  }

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Audit Log</h2>
        <p className="text-muted-foreground">
          View all system activity. {data?.total ?? 0} total entries.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Narrow down the audit trail.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <Input
              placeholder="Search..."
              value={filters.search ?? ""}
              onChange={(e) => updateFilter("search", e.target.value)}
            />
            <Select
              value={filters.action ?? "all"}
              onValueChange={(v) => updateFilter("action", v === "all" ? "" : v)}
            >
              <SelectTrigger><SelectValue placeholder="All actions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {AUDIT_ACTIONS.map((action) => (
                  <SelectItem key={action} value={action}>{action}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Entity type..."
              value={filters.entityType ?? ""}
              onChange={(e) => updateFilter("entityType", e.target.value)}
            />
            <Input
              type="date"
              value={filters.dateFrom ?? ""}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Time</TableHead>
                <TableHead className="w-24">Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead className="w-20">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data.map((entry) => (
                <>
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer"
                    onClick={() => setExpandedRow(expandedRow === entry.id ? null : entry.id)}
                  >
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTimestamp(entry.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ACTION_COLORS[entry.action] ?? "secondary"}>
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{entry.entityType}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {entry.entityId ? entry.entityId.slice(0, 8) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        {expandedRow === entry.id ? "Hide" : "Show"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedRow === entry.id && (
                    <TableRow key={`${entry.id}-detail`}>
                      <TableCell colSpan={5} className="bg-muted/50">
                        <div className="grid gap-4 sm:grid-cols-2 p-2">
                          {entry.previousData && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Previous</p>
                              <pre className="text-xs bg-background p-2 rounded max-h-40 overflow-auto">
                                {JSON.stringify(entry.previousData, null, 2)}
                              </pre>
                            </div>
                          )}
                          {entry.newData && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">New</p>
                              <pre className="text-xs bg-background p-2 rounded max-h-40 overflow-auto">
                                {JSON.stringify(entry.newData, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
              {data?.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No audit log entries found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data?.hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
