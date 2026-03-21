import { eq, and, isNull, lte, sql, or } from "drizzle-orm";
import type { getTenantDb } from "../db/client.js";
import {
  customerRateCards,
  customerRateCardEntries,
  customerMaterials,
} from "../db/schema/tenant.js";

type TenantDb = ReturnType<typeof getTenantDb>;

export interface RateLookupResult {
  rate: number;
  source: "rate_card" | "standard" | "not_found";
  rateCardEntryId?: string;
  rateCardName?: string;
}

/**
 * Three-tier rate lookup per doc 09:
 * 1. Customer rate card entry (active, effective date, matching category+subcategory)
 * 2. Standard rate (customer_materials.salePrice)
 * 3. Not found → manual entry
 */
export async function lookupRate(
  tenantDb: TenantDb,
  customerId: string,
  materialSubcategoryId: string | undefined,
  category: string,
  rateType: string,
  jobDate?: string,
): Promise<RateLookupResult> {
  const todayParts = new Date().toISOString().split("T");
  const asOfDate = jobDate ?? todayParts[0] ?? "2026-01-01";

  // Tier 1: Customer rate card — exact subcategory match
  const exactMatch = await findRateCardEntry(
    tenantDb, customerId, category, rateType, asOfDate,
    materialSubcategoryId
      ? eq(customerRateCardEntries.materialSubcategoryId, materialSubcategoryId)
      : isNull(customerRateCardEntries.materialSubcategoryId),
  );
  if (exactMatch) return exactMatch;

  // Tier 1b: Customer rate card — broader match (category-level, no subcategory)
  if (materialSubcategoryId) {
    const broadMatch = await findRateCardEntry(
      tenantDb, customerId, category, rateType, asOfDate,
      isNull(customerRateCardEntries.materialSubcategoryId),
    );
    if (broadMatch) return broadMatch;
  }

  // Tier 2: Standard rate from customer_materials
  if (materialSubcategoryId) {
    const standardResults = await tenantDb
      .select({ salePrice: customerMaterials.salePrice })
      .from(customerMaterials)
      .where(
        and(
          eq(customerMaterials.customerId, customerId),
          eq(customerMaterials.subcategoryId, materialSubcategoryId),
          isNull(customerMaterials.deletedAt),
        ),
      )
      .limit(1);

    const firstResult = standardResults[0];
    if (firstResult?.salePrice) {
      return {
        rate: parseFloat(firstResult.salePrice),
        source: "standard",
      };
    }
  }

  // Tier 3: Not found
  return { rate: 0, source: "not_found" };
}

async function findRateCardEntry(
  tenantDb: TenantDb,
  customerId: string,
  category: string,
  rateType: string,
  asOfDate: string,
  subcategoryCondition: ReturnType<typeof eq>,
): Promise<RateLookupResult | null> {
  const results = await tenantDb
    .select({
      entryId: customerRateCardEntries.id,
      unitRate: customerRateCardEntries.unitRate,
      cardName: customerRateCards.name,
    })
    .from(customerRateCardEntries)
    .innerJoin(customerRateCards, eq(customerRateCardEntries.rateCardId, customerRateCards.id))
    .where(
      and(
        eq(customerRateCards.customerId, customerId),
        eq(customerRateCards.isActive, true),
        isNull(customerRateCards.deletedAt),
        lte(customerRateCards.effectiveFrom, asOfDate),
        or(
          isNull(customerRateCards.effectiveTo),
          sql`${customerRateCards.effectiveTo} >= ${asOfDate}`,
        ),
        eq(customerRateCardEntries.category, category),
        eq(customerRateCardEntries.rateType, rateType),
        subcategoryCondition,
      ),
    )
    .limit(1);

  const entry = results[0];
  if (!entry) return null;

  return {
    rate: parseFloat(entry.unitRate),
    source: "rate_card",
    rateCardEntryId: entry.entryId,
    rateCardName: entry.cardName,
  };
}
