import { useQuery } from "@tanstack/react-query";
import { CreditCard, ShieldAlert } from "lucide-react";
import { api } from "@frontend/lib/api-client.js";
import { Badge } from "@frontend/components/ui/badge.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@frontend/components/ui/card.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/components/ui/table.js";

interface CreditDashboardItem {
  companyId: string;
  companyName: string;
  creditLimit: number | null;
  creditUsed: number;
  creditAvailable: number | null;
  utilizationPercent: number | null;
  creditStop: boolean;
  creditStopReason: string | null;
}

function formatCurrency(val: number | null): string {
  if (val === null) return "No limit";
  return `$${val.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CreditDashboardPage(): React.JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: ["credit", "dashboard"],
    queryFn: () => api.get<CreditDashboardItem[]>("/api/v1/credit/dashboard"),
  });

  const items = data ?? [];
  const atRisk = items.filter((i) => (i.utilizationPercent ?? 0) >= 80 || i.creditStop);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Credit Monitoring</h1>
        <p className="text-sm text-muted-foreground">
          Real-time view of customer credit positions
        </p>
      </div>

      {atRisk.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-orange-700">
              <ShieldAlert className="h-5 w-5" />
              <span className="font-medium">{atRisk.length} customer{atRisk.length === 1 ? "" : "s"} at risk or stopped</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Customers</CardTitle>
          <CardDescription>{items.length} customers with credit settings</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <CreditCard className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No customer credit data</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Credit Limit</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Utilisation</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.companyId}>
                    <TableCell className="font-medium">{item.companyName}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(item.creditLimit)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(item.creditUsed)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(item.creditAvailable)}</TableCell>
                    <TableCell className="text-right">
                      {item.utilizationPercent !== null ? (
                        <span className={item.utilizationPercent >= 80 ? "font-medium text-orange-600" : ""}>
                          {item.utilizationPercent.toFixed(0)}%
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {item.creditStop ? (
                        <Badge variant="destructive">Stopped</Badge>
                      ) : (item.utilizationPercent ?? 0) >= 80 ? (
                        <Badge variant="outline" className="text-orange-600 border-orange-300">Warning</Badge>
                      ) : (
                        <Badge variant="secondary">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
