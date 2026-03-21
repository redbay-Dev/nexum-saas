import { eq, and, isNull } from "drizzle-orm";
import type { getTenantDb } from "../db/client.js";
import { jobPricingLines, organisation } from "../db/schema/tenant.js";

type TenantDb = ReturnType<typeof getTenantDb>;

/**
 * Snapshot all pricing lines on a job — sets snapshotAt to current time.
 * Called when a job transitions to "confirmed".
 */
export async function snapshotJobPricing(
  tenantDb: TenantDb,
  jobId: string,
): Promise<number> {
  const lines = await tenantDb
    .select({ id: jobPricingLines.id })
    .from(jobPricingLines)
    .where(
      and(
        eq(jobPricingLines.jobId, jobId),
        isNull(jobPricingLines.snapshotAt),
      ),
    );

  if (lines.length === 0) return 0;

  const now = new Date();
  for (const line of lines) {
    await tenantDb
      .update(jobPricingLines)
      .set({ snapshotAt: now, updatedAt: now })
      .where(eq(jobPricingLines.id, line.id));
  }

  return lines.length;
}

/**
 * Lock all pricing lines on a job — sets isLocked to true.
 * Called when a job transitions to "invoiced".
 */
export async function lockJobPricing(
  tenantDb: TenantDb,
  jobId: string,
): Promise<number> {
  const lines = await tenantDb
    .select({ id: jobPricingLines.id })
    .from(jobPricingLines)
    .where(
      and(
        eq(jobPricingLines.jobId, jobId),
        eq(jobPricingLines.isLocked, false),
      ),
    );

  if (lines.length === 0) return 0;

  const now = new Date();
  for (const line of lines) {
    await tenantDb
      .update(jobPricingLines)
      .set({ isLocked: true, snapshotAt: now, updatedAt: now })
      .where(eq(jobPricingLines.id, line.id));
  }

  return lines.length;
}

/**
 * Get the tenant's quote pricing mode.
 */
export async function getQuotePricingMode(
  tenantDb: TenantDb,
): Promise<string> {
  const [org] = await tenantDb
    .select({ quotePricingMode: organisation.quotePricingMode })
    .from(organisation)
    .limit(1);

  return org?.quotePricingMode ?? "lock_at_quote";
}

/**
 * Check if a pricing line is in a post-snapshot state
 * (modifications should create variation lines instead).
 */
export function isPostSnapshot(snapshotAt: Date | null): boolean {
  return snapshotAt !== null;
}
