import { useQuery } from "@tanstack/react-query";
import { api } from "@frontend/lib/api-client.js";
import { Card, CardContent, CardHeader, CardTitle } from "@frontend/components/ui/card.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@frontend/components/ui/table.js";
import { Badge } from "@frontend/components/ui/badge.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { cn } from "@frontend/lib/utils.js";

interface FinancialSummary {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  marginPercent: number | null;
  categoryBreakdown: Array<{
    category: string;
    revenue: number;
    cost: number;
  }>;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(value);
}

function getMarginColor(margin: number | null): string {
  if (margin === null) return "text-muted-foreground";
  if (margin >= 20) return "text-green-600";
  if (margin >= 10) return "text-yellow-600";
  return "text-red-600";
}

function getMarginBadgeVariant(margin: number | null): "default" | "secondary" | "destructive" {
  if (margin === null) return "secondary";
  if (margin >= 20) return "default";
  if (margin >= 10) return "secondary";
  return "destructive";
}

const CATEGORY_LABELS: Record<string, string> = {
  hire: "Hire",
  cartage: "Cartage",
  tip_fee: "Tip Fee",
  material: "Material",
  subcontractor: "Subcontractor",
  equipment: "Equipment",
  labour: "Labour",
  fuel_levy: "Fuel Levy",
  other: "Other",
};

interface JobFinancialSummaryProps {
  jobId: string;
}

export function JobFinancialSummary({ jobId }: JobFinancialSummaryProps): React.JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: ["jobs", jobId, "financial-summary"],
    queryFn: () => api.get<FinancialSummary>(`/api/v1/jobs/${jobId}/financial-summary`),
    enabled: Boolean(jobId),
  });

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          No pricing data available.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Financial Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="text-lg font-semibold">{formatCurrency(data.totalRevenue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cost</p>
            <p className="text-lg font-semibold">{formatCurrency(data.totalCost)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Gross Profit</p>
            <p className={cn("text-lg font-semibold", data.grossProfit < 0 ? "text-red-600" : "")}>
              {formatCurrency(data.grossProfit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Margin</p>
            <p className={cn("text-lg font-semibold", getMarginColor(data.marginPercent))}>
              {data.marginPercent !== null ? `${data.marginPercent}%` : "—"}
            </p>
            <Badge variant={getMarginBadgeVariant(data.marginPercent)} className="text-xs">
              {data.marginPercent === null
                ? "No revenue"
                : data.marginPercent >= 20
                  ? "Healthy"
                  : data.marginPercent >= 10
                    ? "Low"
                    : "Below threshold"}
            </Badge>
          </div>
        </div>

        {data.categoryBreakdown.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.categoryBreakdown.map((cat) => (
                <TableRow key={cat.category}>
                  <TableCell>{CATEGORY_LABELS[cat.category] ?? cat.category}</TableCell>
                  <TableCell className="text-right">{formatCurrency(cat.revenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(cat.cost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
