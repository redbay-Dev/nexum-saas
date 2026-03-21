import { eq, and, lte, desc } from "drizzle-orm";
import type { getTenantDb } from "../db/client.js";
import { priceHistory } from "../db/schema/tenant.js";

type TenantDb = ReturnType<typeof getTenantDb>;

/**
 * Record a price change in the history table.
 */
export async function recordPriceChange(
  tenantDb: TenantDb,
  entityType: string,
  entityId: string,
  previousPrice: number | null,
  newPrice: number,
  effectiveDate: string,
  changeSource: string,
  changedBy: string,
  bulkUpdateId?: string,
  notes?: string,
): Promise<void> {
  await tenantDb.insert(priceHistory).values({
    entityType,
    entityId,
    previousPrice: previousPrice?.toString() ?? null,
    newPrice: newPrice.toString(),
    effectiveDate,
    changeSource,
    changedBy,
    bulkUpdateId,
    notes,
  });
}

/**
 * Get the effective price as of a given date.
 * Returns the most recent price_history entry with effective_date <= asOfDate.
 * Falls back to currentPrice if no history exists before the date.
 */
export async function getPriceAsOf(
  tenantDb: TenantDb,
  entityType: string,
  entityId: string,
  asOfDate: string,
  currentPrice: number,
): Promise<number> {
  const [historyEntry] = await tenantDb
    .select({ newPrice: priceHistory.newPrice })
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.entityType, entityType),
        eq(priceHistory.entityId, entityId),
        lte(priceHistory.effectiveDate, asOfDate),
      ),
    )
    .orderBy(desc(priceHistory.effectiveDate), desc(priceHistory.createdAt))
    .limit(1);

  if (historyEntry) {
    return parseFloat(historyEntry.newPrice);
  }

  return currentPrice;
}

/**
 * Get full price history for an entity.
 */
export async function getPriceHistory(
  tenantDb: TenantDb,
  entityType: string,
  entityId: string,
  limit: number = 50,
): Promise<Array<typeof priceHistory.$inferSelect>> {
  return tenantDb
    .select()
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.entityType, entityType),
        eq(priceHistory.entityId, entityId),
      ),
    )
    .orderBy(desc(priceHistory.effectiveDate), desc(priceHistory.createdAt))
    .limit(limit);
}
