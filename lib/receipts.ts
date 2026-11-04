import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { subscriptionOrders } from "@/db/schema";

export type Receipt = {
  orderId: string;
  number: string;
  issuedAt: Date;
  planSku: string;
  days: number;
  amountGrosze: number;
  paidAt: Date | null;
  buyerName: string | null;
  buyerTaxId: string | null;
};

const receiptColumns = {
  orderId: subscriptionOrders.id,
  number: subscriptionOrders.receiptNumber,
  issuedAt: subscriptionOrders.receiptIssuedAt,
  planSku: subscriptionOrders.planSku,
  days: subscriptionOrders.days,
  amountGrosze: subscriptionOrders.amountGrosze,
  paidAt: subscriptionOrders.paidAt,
  buyerName: subscriptionOrders.buyerName,
  buyerTaxId: subscriptionOrders.buyerTaxId,
};

/** Wystawiony dokument zamówienia użytkownika albo `null` (brak zamówienia, cudze lub bez numeru). */
export async function getIssuedReceipt(userId: string, orderId: string): Promise<Receipt | null> {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select(receiptColumns)
    .from(subscriptionOrders)
    .where(and(eq(subscriptionOrders.id, orderId), eq(subscriptionOrders.userId, userId)))
    .limit(1);
  if (!row?.number || !row.issuedAt) return null;
  return { ...row, number: row.number, issuedAt: row.issuedAt };
}

export type IssueReceiptResult =
  | { ok: true; receipt: Receipt }
  | { ok: false; reason: "not_found" | "not_paid" | "failed" };

/**
 * Wystawia dokument sprzedaży dla opłaconego zamówienia użytkownika (idempotentnie).
 * Numer GB/RRRR/NNNNNN z atomowego licznika rocznego: licznik rośnie tylko, gdy zamówienie
 * faktycznie dostaje numer (jedna transakcja `db.batch`), a unikalny indeks pilnuje duplikatów.
 * Dane nabywcy zapisujemy tylko przed wystawieniem — po numeracji dokument się nie zmienia.
 */
export async function issueReceipt(
  userId: string,
  orderId: string,
  buyer: { name: string | null; taxId: string | null },
  now: Date = new Date(),
): Promise<IssueReceiptResult> {
  await ensureCriticalSchema();
  const db = getDb();

  const [order] = await db
    .select({
      status: subscriptionOrders.status,
      number: subscriptionOrders.receiptNumber,
      paidAt: subscriptionOrders.paidAt,
    })
    .from(subscriptionOrders)
    .where(and(eq(subscriptionOrders.id, orderId), eq(subscriptionOrders.userId, userId)))
    .limit(1);
  if (!order) return { ok: false, reason: "not_found" };
  if (order.status !== "paid") return { ok: false, reason: "not_paid" };

  if (!order.number) {
    // Rok numeracji = rok opłacenia (czas polski), a nie rok wystawienia.
    const year = Number(
      new Intl.DateTimeFormat("en-CA", { year: "numeric", timeZone: "Europe/Warsaw" }).format(
        order.paidAt ?? now,
      ),
    );
    const issuedMs = now.getTime();
    const mine = and(
      eq(subscriptionOrders.id, orderId),
      eq(subscriptionOrders.userId, userId),
      eq(subscriptionOrders.status, "paid"),
      isNull(subscriptionOrders.receiptNumber),
    );
    await db.batch([
      db
        .update(subscriptionOrders)
        .set({ buyerName: buyer.name, buyerTaxId: buyer.taxId })
        .where(mine),
      db.run(sql`INSERT INTO receipt_counters (year, last_number)
        SELECT ${year}, 1
        WHERE EXISTS (SELECT 1 FROM subscription_orders WHERE id = ${orderId} AND user_id = ${userId} AND status = 'paid' AND receipt_number IS NULL)
        ON CONFLICT(year) DO UPDATE SET last_number = last_number + 1`),
      db.run(sql`UPDATE subscription_orders
        SET receipt_number = 'GB/' || ${year} || '/' || printf('%06d', (SELECT last_number FROM receipt_counters WHERE year = ${year})),
            receipt_issued_at = ${issuedMs}
        WHERE id = ${orderId} AND user_id = ${userId} AND status = 'paid' AND receipt_number IS NULL`),
    ]);
  }

  const receipt = await getIssuedReceipt(userId, orderId);
  return receipt ? { ok: true, receipt } : { ok: false, reason: "failed" };
}
