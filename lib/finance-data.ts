import "server-only";

import { and, gt, gte, inArray, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { subscriptionOrders, users } from "@/db/schema";
import { aggregateRevenue, conversionRate } from "@/lib/finance";

const MONTHS = 12;

export async function getFinanceSummary(db: Database, now = Date.now()) {
  // ~13 miesięcy wstecz wystarcza na 12 pełnych kubełków miesięcznych.
  const since = new Date(now - 400 * 86_400_000);
  const rows = await db
    .select({
      status: subscriptionOrders.status,
      amountGrosze: subscriptionOrders.amountGrosze,
      paidAt: subscriptionOrders.paidAt,
    })
    .from(subscriptionOrders)
    .where(and(inArray(subscriptionOrders.status, ["paid", "manual", "refunded"]), gte(subscriptionOrders.paidAt, since)));
  const { daily, monthly } = aggregateRevenue(rows, now, { days: 30, months: MONTHS });

  const [active] = await db
    .select({ n: sql<number>`count(*)` })
    .from(users)
    .where(gt(users.packageEndsAt, new Date(now)));

  const since30 = new Date(now - 30 * 86_400_000);
  const [created] = await db
    .select({ n: sql<number>`count(*)` })
    .from(subscriptionOrders)
    .where(gte(subscriptionOrders.createdAt, since30));
  const [paid] = await db
    .select({ n: sql<number>`count(*)` })
    .from(subscriptionOrders)
    .where(and(gte(subscriptionOrders.createdAt, since30), inArray(subscriptionOrders.status, ["paid"])));
  const createdN = Number(created?.n ?? 0);
  const paidN = Number(paid?.n ?? 0);

  return {
    daily,
    monthly,
    activePackages: Number(active?.n ?? 0),
    conversion30d: { created: createdN, paid: paidN, rate: conversionRate(createdN, paidN) },
  };
}
