import "server-only";

import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { subscriptionPlans } from "@/db/schema";

export {
  formatPlnFromGrosze,
  parsePlnToGrosze,
} from "@/lib/subscription-plans-format";

export type SubscriptionPlanRow = {
  id: string;
  sku: string;
  title: string;
  description: string;
  days: number;
  priceGrosze: number;
  active: number;
  sortOrder: number;
  updatedAt: Date;
};

export async function listSubscriptionPlans(opts?: {
  activeOnly?: boolean;
}): Promise<SubscriptionPlanRow[]> {
  await ensureCriticalSchema();
  const db = getDb();
  const rows = await db
    .select()
    .from(subscriptionPlans)
    .orderBy(asc(subscriptionPlans.sortOrder), asc(subscriptionPlans.days));
  if (opts?.activeOnly) {
    return rows.filter((r) => r.active === 1);
  }
  return rows;
}

export async function getSubscriptionPlanBySku(
  sku: string,
): Promise<SubscriptionPlanRow | null> {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.sku, sku))
    .limit(1);
  return row ?? null;
}

export async function getSubscriptionPlanById(
  id: string,
): Promise<SubscriptionPlanRow | null> {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, id))
    .limit(1);
  return row ?? null;
}
