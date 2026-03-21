import { eq, and, isNull } from "drizzle-orm";
import type { getTenantDb } from "../db/client.js";
import { marginThresholds, jobPricingLines, jobs } from "../db/schema/tenant.js";

type TenantDb = ReturnType<typeof getTenantDb>;

export interface MarginCheckResult {
  status: "ok" | "warning" | "blocked";
  actualMarginPercent: number | null;
  thresholdLevel: string | null;
  minimumMarginPercent: number | null;
  warningMarginPercent: number | null;
  requiresApproval: boolean;
  message: string | null;
}

/**
 * Check a pricing line's margin against the most specific threshold.
 * Lookup order (most specific wins): material_type > customer > category > global.
 */
export async function checkMargin(
  tenantDb: TenantDb,
  lineType: string,
  category: string,
  unitRate: number,
  quantity: number,
  total: number,
  jobId: string,
  materialCategoryId?: string,
): Promise<MarginCheckResult> {
  // Only check revenue lines — cost lines don't have margins to validate
  if (lineType !== "revenue") {
    return { status: "ok", actualMarginPercent: null, thresholdLevel: null, minimumMarginPercent: null, warningMarginPercent: null, requiresApproval: false, message: null };
  }

  // Get job to find customer for customer-level threshold
  const [job] = await tenantDb
    .select({ customerId: jobs.customerId })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  // Get total cost for this job to compute margin
  const costLines = await tenantDb
    .select({ total: jobPricingLines.total })
    .from(jobPricingLines)
    .where(
      and(
        eq(jobPricingLines.jobId, jobId),
        eq(jobPricingLines.lineType, "cost"),
      ),
    );

  const totalCost = costLines.reduce((sum, line) => sum + parseFloat(line.total), 0);
  const revenueLines = await tenantDb
    .select({ total: jobPricingLines.total })
    .from(jobPricingLines)
    .where(
      and(
        eq(jobPricingLines.jobId, jobId),
        eq(jobPricingLines.lineType, "revenue"),
      ),
    );

  const totalRevenue = revenueLines.reduce((sum, line) => sum + parseFloat(line.total), 0) + total;
  const actualMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

  // Load all active thresholds
  const thresholds = await tenantDb
    .select()
    .from(marginThresholds)
    .where(
      and(
        eq(marginThresholds.isActive, true),
        isNull(marginThresholds.deletedAt),
      ),
    );

  // Find most specific threshold
  let bestThreshold: typeof thresholds[number] | null = null;
  let bestSpecificity = -1;

  for (const t of thresholds) {
    let specificity = 0;

    if (t.level === "material_type" && materialCategoryId && t.referenceId === materialCategoryId) {
      specificity = 4;
    } else if (t.level === "customer" && job?.customerId && t.referenceId === job.customerId) {
      specificity = 3;
    } else if (t.level === "category" && t.referenceId === category) {
      specificity = 2;
    } else if (t.level === "global" && !t.referenceId) {
      specificity = 1;
    } else {
      continue;
    }

    if (specificity > bestSpecificity) {
      bestSpecificity = specificity;
      bestThreshold = t;
    }
  }

  if (!bestThreshold) {
    return { status: "ok", actualMarginPercent: Math.round(actualMargin * 100) / 100, thresholdLevel: null, minimumMarginPercent: null, warningMarginPercent: null, requiresApproval: false, message: null };
  }

  const minimumMargin = parseFloat(bestThreshold.minimumMarginPercent);
  const warningMargin = parseFloat(bestThreshold.warningMarginPercent);

  if (actualMargin < minimumMargin) {
    return {
      status: bestThreshold.requiresApproval ? "blocked" : "warning",
      actualMarginPercent: Math.round(actualMargin * 100) / 100,
      thresholdLevel: bestThreshold.level,
      minimumMarginPercent: minimumMargin,
      warningMarginPercent: warningMargin,
      requiresApproval: bestThreshold.requiresApproval,
      message: `Margin ${actualMargin.toFixed(1)}% is below minimum ${minimumMargin}% (${bestThreshold.level} threshold)`,
    };
  }

  if (actualMargin < warningMargin) {
    return {
      status: "warning",
      actualMarginPercent: Math.round(actualMargin * 100) / 100,
      thresholdLevel: bestThreshold.level,
      minimumMarginPercent: minimumMargin,
      warningMarginPercent: warningMargin,
      requiresApproval: false,
      message: `Margin ${actualMargin.toFixed(1)}% is below warning level ${warningMargin}% (${bestThreshold.level} threshold)`,
    };
  }

  return {
    status: "ok",
    actualMarginPercent: Math.round(actualMargin * 100) / 100,
    thresholdLevel: bestThreshold.level,
    minimumMarginPercent: minimumMargin,
    warningMarginPercent: warningMargin,
    requiresApproval: false,
    message: null,
  };
}
