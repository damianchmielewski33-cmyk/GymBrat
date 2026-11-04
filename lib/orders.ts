import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { subscriptionOrders } from "@/db/schema";

export type UserOrder = {
  id: string;
  planSku: string;
  days: number;
  amountGrosze: number;
  status: string;
  createdAt: Date;
  paidAt: Date | null;
  receiptNumber: string | null;
};

/** Zamówienia użytkownika (najnowsze pierwsze). Tylko własne — zawsze filtr po `userId`. */
export async function listUserOrders(userId: string, limit = 50): Promise<UserOrder[]> {
  await ensureCriticalSchema();
  const db = getDb();
  return db
    .select({
      id: subscriptionOrders.id,
      planSku: subscriptionOrders.planSku,
      days: subscriptionOrders.days,
      amountGrosze: subscriptionOrders.amountGrosze,
      status: subscriptionOrders.status,
      createdAt: subscriptionOrders.createdAt,
      paidAt: subscriptionOrders.paidAt,
      receiptNumber: subscriptionOrders.receiptNumber,
    })
    .from(subscriptionOrders)
    .where(eq(subscriptionOrders.userId, userId))
    .orderBy(desc(subscriptionOrders.createdAt))
    .limit(limit);
}

/** Jedno zamówienie, tylko jeśli należy do użytkownika (inaczej `null` — bez ujawniania istnienia). */
export async function getUserOrder(userId: string, orderId: string): Promise<UserOrder | null> {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select({
      id: subscriptionOrders.id,
      planSku: subscriptionOrders.planSku,
      days: subscriptionOrders.days,
      amountGrosze: subscriptionOrders.amountGrosze,
      status: subscriptionOrders.status,
      createdAt: subscriptionOrders.createdAt,
      paidAt: subscriptionOrders.paidAt,
      receiptNumber: subscriptionOrders.receiptNumber,
    })
    .from(subscriptionOrders)
    .where(and(eq(subscriptionOrders.id, orderId), eq(subscriptionOrders.userId, userId)))
    .limit(1);
  return row ?? null;
}
