import { eq, and, isNull, asc } from "drizzle-orm";
import type { getTenantDb } from "../db/client.js";
import { markupRules } from "../db/schema/tenant.js";

type TenantDb = ReturnType<typeof getTenantDb>;

export interface MarkupRule {
  id: string;
  name: string;
  type: string;
  markupPercentage: string | null;
  markupFixedAmount: string | null;
  materialCategoryId: string | null;
  supplierId: string | null;
  priority: number;
}

export interface MarkupResult {
  revenueUnitRate: number;
  revenueTotal: number;
  rule: MarkupRule;
}

/**
 * Find the highest-priority (lowest number) active markup rule matching the given filters.
 * Priority matching: most specific rule wins (both materialCategoryId + supplierId > one > neither).
 * Within the same specificity, lower priority number wins.
 */
export async function findMatchingRule(
  tenantDb: TenantDb,
  materialCategoryId: string | undefined,
  supplierId: string | undefined,
): Promise<MarkupRule | null> {
  const rules = await tenantDb
    .select()
    .from(markupRules)
    .where(
      and(
        eq(markupRules.isActive, true),
        isNull(markupRules.deletedAt),
      ),
    )
    .orderBy(asc(markupRules.priority));

  // Score rules by specificity: both filters match > one filter > no filter (catch-all)
  let bestRule: MarkupRule | null = null;
  let bestScore = -1;

  for (const rule of rules) {
    let score = 0;
    const categoryMatch = rule.materialCategoryId === null || rule.materialCategoryId === materialCategoryId;
    const supplierMatch = rule.supplierId === null || rule.supplierId === supplierId;

    if (!categoryMatch || !supplierMatch) continue;

    if (rule.materialCategoryId && rule.materialCategoryId === materialCategoryId) score += 2;
    if (rule.supplierId && rule.supplierId === supplierId) score += 2;

    if (score > bestScore || (score === bestScore && (!bestRule || rule.priority < bestRule.priority))) {
      bestScore = score;
      bestRule = rule;
    }
  }

  return bestRule;
}

/**
 * Apply a markup rule to a cost line to generate the revenue line amounts.
 */
export function applyMarkup(
  costUnitRate: number,
  quantity: number,
  rule: MarkupRule,
): MarkupResult {
  let revenueUnitRate: number;

  if (rule.type === "percentage" && rule.markupPercentage) {
    const percentage = parseFloat(rule.markupPercentage);
    revenueUnitRate = costUnitRate * (1 + percentage / 100);
  } else if (rule.type === "fixed" && rule.markupFixedAmount) {
    const fixedAmount = parseFloat(rule.markupFixedAmount);
    revenueUnitRate = costUnitRate + fixedAmount;
  } else {
    revenueUnitRate = costUnitRate;
  }

  return {
    revenueUnitRate: Math.round(revenueUnitRate * 10000) / 10000,
    revenueTotal: Math.round(revenueUnitRate * quantity * 100) / 100,
    rule,
  };
}
