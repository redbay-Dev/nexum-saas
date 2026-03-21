import { eq, and, isNull, lte } from "drizzle-orm";
import type { getTenantDb } from "../db/client.js";
import { surcharges } from "../db/schema/tenant.js";

type TenantDb = ReturnType<typeof getTenantDb>;

interface SurchargeMatch {
  id: string;
  name: string;
  type: string;
  value: string;
}

export interface SurchargeLine {
  surchargeId: string;
  surchargeName: string;
  unitRate: number;
  total: number;
}

/**
 * Find active, auto-apply surcharges that apply to the given pricing category
 * and are within their effective date range.
 */
export async function findApplicableSurcharges(
  tenantDb: TenantDb,
  category: string,
  jobDate?: string,
): Promise<SurchargeMatch[]> {
  const todayParts = new Date().toISOString().split("T");
  const asOfDate = jobDate ?? todayParts[0] ?? "2026-01-01";

  const allSurcharges = await tenantDb
    .select({
      id: surcharges.id,
      name: surcharges.name,
      type: surcharges.type,
      value: surcharges.value,
      appliesTo: surcharges.appliesTo,
      effectiveTo: surcharges.effectiveTo,
    })
    .from(surcharges)
    .where(
      and(
        eq(surcharges.isActive, true),
        eq(surcharges.autoApply, true),
        isNull(surcharges.deletedAt),
        lte(surcharges.effectiveFrom, asOfDate),
      ),
    );

  // Filter by category and effective date range in JS (JSONB array contains check)
  return allSurcharges.filter((s) => {
    const applies = s.appliesTo as string[];
    if (!applies.includes(category)) return false;
    if (s.effectiveTo && s.effectiveTo < asOfDate) return false;
    return true;
  });
}

/**
 * Generate surcharge pricing line data from a base pricing line.
 * Returns line data ready to insert (caller handles DB insert).
 * Will NOT cascade — surcharge lines have source="surcharge" and are skipped.
 */
export function generateSurchargeLines(
  baseUnitRate: number,
  baseQuantity: number,
  baseTotal: number,
  applicableSurcharges: SurchargeMatch[],
): SurchargeLine[] {
  return applicableSurcharges.map((s) => {
    const surchargeValue = parseFloat(s.value);
    let lineUnitRate: number;
    let lineTotal: number;

    if (s.type === "percentage") {
      lineUnitRate = Math.round(baseUnitRate * (surchargeValue / 100) * 10000) / 10000;
      lineTotal = Math.round(baseTotal * (surchargeValue / 100) * 100) / 100;
    } else {
      // Fixed amount per unit
      lineUnitRate = surchargeValue;
      lineTotal = Math.round(surchargeValue * baseQuantity * 100) / 100;
    }

    return {
      surchargeId: s.id,
      surchargeName: s.name,
      unitRate: lineUnitRate,
      total: lineTotal,
    };
  });
}
