import "server-only";

import { and, desc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { subscriptionOrders, users } from "@/db/schema";
import { logPaymentAlert } from "@/lib/payment-alerts";

/** Zamówienia `pending` starsze niż to wygasają (Z22). */
export const PENDING_EXPIRE_MS = 24 * 60 * 60_000;
/** Ponowny start płatności w tym oknie używa istniejącego `pending` (Z22). */
export const CHECKOUT_REUSE_MS = 15 * 60_000;
/** Alert: `pending` wisi dłużej niż to (Z23). */
export const PENDING_ALERT_MS = 60 * 60_000;

/** Statusy, z których można ręcznie zaksięgować zamówienie (przyznać pakiet). */
export const BOOKABLE_STATUSES = ["pending", "amount_mismatch", "cancelled", "failed", "expired"] as const;
export type AdminOrderAction = "book" | "cancel" | "refund";

export type AdminOrderResult = { ok: true } | { ok: false; status: number; error: string };

function noteLine(action: string, adminEmail: string, note: string | undefined, now: Date): string {
  const day = now.toISOString().slice(0, 10);
  return `[${day} ${adminEmail}] ${action}${note ? `: ${note}` : ""}`;
}

function joinNote(prev: string | null, line: string): string {
  return prev ? `${prev}\n${line}` : line;
}

/** Wygaszanie `pending` > 24 h (cron). Zamówienia z późną płatnością zostają do obsługi ręcznej. */
export async function expirePendingOrders(db: Database, now = Date.now()): Promise<number> {
  const rows = await db
    .update(subscriptionOrders)
    .set({ status: "expired" })
    .where(
      and(
        eq(subscriptionOrders.status, "pending"),
        lt(subscriptionOrders.createdAt, new Date(now - PENDING_EXPIRE_MS)),
        isNull(subscriptionOrders.latePaymentAt),
      ),
    )
    .returning({ id: subscriptionOrders.id });
  return rows.length;
}

/** Istniejące, świeże `pending` tego samego użytkownika, pakietu i kwoty (idempotencja checkoutu). */
export async function findReusablePendingOrder(
  db: Database,
  args: { userId: string; planSku: string; amountGrosze: number; now?: number },
): Promise<string | null> {
  const since = new Date((args.now ?? Date.now()) - CHECKOUT_REUSE_MS);
  const [row] = await db
    .select({ id: subscriptionOrders.id })
    .from(subscriptionOrders)
    .where(
      and(
        eq(subscriptionOrders.userId, args.userId),
        eq(subscriptionOrders.planSku, args.planSku),
        eq(subscriptionOrders.amountGrosze, args.amountGrosze),
        eq(subscriptionOrders.status, "pending"),
        sql`${subscriptionOrders.createdAt} >= ${since.getTime()}`,
      ),
    )
    .orderBy(desc(subscriptionOrders.createdAt))
    .limit(1);
  return row?.id ?? null;
}

export async function listAdminOrders(db: Database, opts: { status?: string; limit?: number }) {
  const q = db
    .select({
      id: subscriptionOrders.id,
      planSku: subscriptionOrders.planSku,
      days: subscriptionOrders.days,
      amountGrosze: subscriptionOrders.amountGrosze,
      status: subscriptionOrders.status,
      createdAt: subscriptionOrders.createdAt,
      paidAt: subscriptionOrders.paidAt,
      fulfilledAt: subscriptionOrders.fulfilledAt,
      latePaymentAt: subscriptionOrders.latePaymentAt,
      refundedAt: subscriptionOrders.refundedAt,
      hotpayPaymentId: subscriptionOrders.hotpayPaymentId,
      adminNote: subscriptionOrders.adminNote,
      userEmail: users.email,
    })
    .from(subscriptionOrders)
    .leftJoin(users, eq(users.id, subscriptionOrders.userId));
  const filtered = opts.status ? q.where(eq(subscriptionOrders.status, opts.status)) : q;
  return filtered.orderBy(desc(subscriptionOrders.createdAt)).limit(Math.min(opts.limit ?? 100, 300));
}

export type PaymentAlerts = {
  pendingStale: number;
  paidUnfulfilled: number;
  amountMismatch: number;
  latePayments: number;
  total: number;
};

/** Z23: liczniki do widżetu (pending > 1 h, paid bez przyznanego pakietu, niezgodne kwoty, późne płatności). */
export async function getPaymentAlerts(db: Database, now = Date.now()): Promise<PaymentAlerts> {
  const count = async (where: ReturnType<typeof and>) => {
    const [r] = await db
      .select({ n: sql<number>`count(*)` })
      .from(subscriptionOrders)
      .where(where);
    return Number(r?.n ?? 0);
  };
  const pendingStale = await count(
    and(
      eq(subscriptionOrders.status, "pending"),
      lt(subscriptionOrders.createdAt, new Date(now - PENDING_ALERT_MS)),
    ),
  );
  const paidUnfulfilled = await count(
    and(eq(subscriptionOrders.status, "paid"), isNull(subscriptionOrders.fulfilledAt)),
  );
  const amountMismatch = await count(eq(subscriptionOrders.status, "amount_mismatch"));
  const latePayments = await count(
    and(
      isNotNull(subscriptionOrders.latePaymentAt),
      inArray(subscriptionOrders.status, ["pending", "cancelled", "failed", "expired"]),
    ),
  );
  return {
    pendingStale,
    paidUnfulfilled,
    amountMismatch,
    latePayments,
    total: pendingStale + paidUnfulfilled + amountMismatch + latePayments,
  };
}

/**
 * Akcja admina na zamówieniu (DK-19…): `book` = przyznaj pakiet (jak webhook) i ustaw `manual`;
 * `cancel` = tylko `pending`; `refund` = odnotuj zwrot (status `refunded`, dni pakietu bez zmian).
 */
export async function applyOrderAction(
  db: Database,
  args: { orderId: string; action: AdminOrderAction; adminEmail: string; note?: string; now?: Date },
): Promise<AdminOrderResult> {
  const now = args.now ?? new Date();
  const [order] = await db
    .select()
    .from(subscriptionOrders)
    .where(eq(subscriptionOrders.id, args.orderId))
    .limit(1);
  if (!order) return { ok: false, status: 404, error: "Nie znaleziono zamówienia." };
  const note = joinNote(order.adminNote, noteLine(args.action, args.adminEmail, args.note?.trim(), now));

  if (args.action === "cancel") {
    if (order.status !== "pending") {
      return { ok: false, status: 409, error: "Anulować można tylko zamówienie oczekujące." };
    }
    const rows = await db
      .update(subscriptionOrders)
      .set({ status: "cancelled", adminNote: note })
      .where(and(eq(subscriptionOrders.id, order.id), eq(subscriptionOrders.status, "pending")))
      .returning({ id: subscriptionOrders.id });
    return rows.length > 0 ? { ok: true } : { ok: false, status: 409, error: "Status zmienił się w międzyczasie." };
  }

  if (args.action === "refund") {
    const refundable =
      order.status === "paid" ||
      order.status === "manual" ||
      order.status === "amount_mismatch" ||
      order.latePaymentAt != null;
    if (!refundable || order.status === "refunded") {
      return { ok: false, status: 409, error: "Dla tego zamówienia nie ma płatności do zwrotu." };
    }
    if (!args.note?.trim()) {
      return { ok: false, status: 400, error: "Podaj notatkę o zwrocie (np. numer zwrotu w HotPay)." };
    }
    await db
      .update(subscriptionOrders)
      .set({ status: "refunded", refundedAt: now, adminNote: note })
      .where(eq(subscriptionOrders.id, order.id));
    return { ok: true };
  }

  // book
  if (!order.userId) {
    return { ok: false, status: 409, error: "Zamówienie nie ma konta — nie ma komu przyznać pakietu (zrób zwrot)." };
  }
  if (!(BOOKABLE_STATUSES as readonly string[]).includes(order.status)) {
    return { ok: false, status: 409, error: "To zamówienie jest już zaksięgowane lub zwrócone." };
  }
  const addMs = Math.max(1, order.days) * 86_400_000;
  const bookable = sql.join(
    BOOKABLE_STATUSES.map((s) => sql`${s}`),
    sql`, `,
  );
  // Jedna transakcja; pakiet tylko jeśli zamówienie nadal w stanie księgowalnym (powtórka nie przedłuży drugi raz).
  const [, booked] = await db.batch([
    db
      .update(users)
      .set({
        packageEndsAt: sql`cast(max(${now.getTime()}, coalesce(${users.packageEndsAt}, 0)) + ${addMs} as integer)`,
        packagePlanSku: order.planSku,
      })
      .where(
        and(
          eq(users.id, order.userId),
          sql`exists (select 1 from ${subscriptionOrders} where ${subscriptionOrders.id} = ${order.id} and ${subscriptionOrders.status} in (${bookable}))`,
        ),
      ),
    db
      .update(subscriptionOrders)
      .set({ status: "manual", paidAt: order.paidAt ?? now, fulfilledAt: now, adminNote: note })
      .where(and(eq(subscriptionOrders.id, order.id), inArray(subscriptionOrders.status, [...BOOKABLE_STATUSES])))
      .returning({ id: subscriptionOrders.id }),
  ]);
  if (booked.length === 0) return { ok: false, status: 409, error: "Status zmienił się w międzyczasie." };
  logPaymentAlert("manual_booking", `orders.admin: manual_booking order ${order.id}`, "orders.admin");
  return { ok: true };
}
