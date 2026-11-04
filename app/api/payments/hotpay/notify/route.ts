import { trackKpi, KpiEvents } from "@/lib/analytics/track-kpi";
import { withApiErrors } from "@/lib/errors/api";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { subscriptionOrders, users } from "@/db/schema";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { toAppError } from "@/lib/errors/app-error";
import { logServerError, newRequestId } from "@/lib/errors/server-log";
import { logPaymentAlert } from "@/lib/payment-alerts";
import { verifyHotpayNotificationHash } from "@/lib/hotpay";
import { hotpayKwotaToGrosze } from "@/lib/hotpay-amount";
import { extendUserPackageIfOrderPending } from "@/lib/user-package";

export const runtime = "nodejs";

/**
 * Webhook HotPay (form-data POST). Wywołuje go serwer płatności, bez sesji — wyjątek w `proxy.ts`
 * (`lib/proxy-public-api.ts`); autoryzacja = podpis HASH + zgodność kwoty z zamówieniem.
 * W panelu HotPay ustaw: https://TWOJA-DOMENA/api/payments/hotpay/notify
 */
type OrderRow = typeof subscriptionOrders.$inferSelect;

async function sendOrderConfirmation(db: ReturnType<typeof getDb>, order: OrderRow) {
  if (!order.userId) return;
  try {
    const [buyer] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, order.userId))
      .limit(1);
    if (!buyer?.email) return;
    await sendOrderConfirmationEmail({
      to: buyer.email,
      planSku: order.planSku,
      days: order.days,
      amountGrosze: order.amountGrosze,
    });
  } catch (err) {
    logServerError(toAppError(err), { requestId: newRequestId(), origin: "hotpay.notify.email" }, err);
  }
}

async function handlePOST(req: Request) {
  await ensureCriticalSchema();

  const fields: Record<string, string> = {};
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      const j = (await req.json()) as Record<string, unknown>;
      for (const [k, v] of Object.entries(j)) {
        if (v != null) fields[k] = String(v);
      }
    } else {
      const form = await req.formData();
      for (const [k, v] of form.entries()) {
        if (typeof v === "string") fields[k] = v;
      }
    }
  } catch {
    return new NextResponse("BAD_REQUEST", { status: 400 });
  }

  const kwota = fields.KWOTA ?? "";
  const idPlatnosci = fields.ID_PLATNOSCI ?? "";
  const idZamowienia = fields.ID_ZAMOWIENIA ?? "";
  const status = fields.STATUS ?? "";
  const secure = fields.SECURE ?? "";
  const sekret = fields.SEKRET ?? "";
  const hash = fields.HASH ?? "";

  if (!kwota || !idPlatnosci || !idZamowienia || !status || !sekret || !hash) {
    return new NextResponse("MISSING", { status: 400 });
  }

  const okHash = verifyHotpayNotificationHash({
    kwota,
    idPlatnosci,
    idZamowienia,
    status,
    secure: secure || undefined,
    sekret,
    hash,
  });
  if (!okHash) {
    return new NextResponse("INVALID_HASH", { status: 403 });
  }

  const db = getDb();
  const [order] = await db
    .select()
    .from(subscriptionOrders)
    .where(eq(subscriptionOrders.id, idZamowienia))
    .limit(1);

  if (!order) {
    return new NextResponse("ORDER_NOT_FOUND", { status: 404 });
  }

  if (status === "SUCCESS") {
    if (order.status === "pending" && !order.userId) {
      // Konto usunięte przed zaksięgowaniem — nie ma komu przyznać pakietu; do ręcznej obsługi (zwrot).
      await db
        .update(subscriptionOrders)
        .set({ latePaymentAt: new Date(), hotpayPaymentId: idPlatnosci })
        .where(and(eq(subscriptionOrders.id, order.id), isNull(subscriptionOrders.latePaymentAt)));
      logPaymentAlert("paid_without_user", `hotpay.notify: paid_order_without_user ${order.id} ${idPlatnosci}`);
    } else if (order.status === "pending" && order.userId) {
      // Pakiet tylko za zgodną kwotę: `KWOTA` z powiadomienia musi równać się cenie zamówienia.
      // Podpis HASH nie chroni kwoty przed płatnością za grosze, jeśli ktoś zmieni ją w formularzu płatności.
      const paidGrosze = hotpayKwotaToGrosze(kwota);
      if (paidGrosze !== order.amountGrosze) {
        const flagged = await db
          .update(subscriptionOrders)
          .set({ status: "amount_mismatch", hotpayPaymentId: idPlatnosci })
          .where(
            and(
              eq(subscriptionOrders.id, order.id),
              eq(subscriptionOrders.status, "pending"),
            ),
          )
          .returning({ id: subscriptionOrders.id });
        if (flagged.length > 0) {
          // Do ręcznej obsługi (zwrot/wyjaśnienie): tylko identyfikatory i kwoty, bez danych osobowych.
          logPaymentAlert(
            "amount_mismatch",
            `hotpay.notify: amount_mismatch order ${order.id} payment ${idPlatnosci} expected ${order.amountGrosze} got ${kwota}`,
          );
        }
        return new NextResponse("OK", { status: 200 });
      }

      // Jedna transakcja (libSQL batch): przedłużenie pakietu jest warunkowane statusem `pending`,
      // więc powtórka i równoległe powiadomienie nie przedłużą go drugi raz, a awaria w połowie
      // nie zostawi zamówienia `paid` bez pakietu ani pakietu bez `paid`.
      const [, paidRows] = await db.batch([
        extendUserPackageIfOrderPending(db, {
          userId: order.userId,
          orderId: order.id,
          days: order.days,
          planSku: order.planSku,
        }),
        db
          .update(subscriptionOrders)
          .set({
            status: "paid",
            hotpayPaymentId: idPlatnosci,
            paidAt: new Date(),
            fulfilledAt: new Date(),
          })
          .where(
            and(
              eq(subscriptionOrders.id, order.id),
              eq(subscriptionOrders.status, "pending"),
            ),
          )
          .returning({ id: subscriptionOrders.id }),
      ]);
      // Z20: e-mail z potwierdzeniem tylko przy faktycznym przejściu pending → paid; błąd wysyłki
      // (np. brak SMTP) nie może zepsuć księgowania ani odpowiedzi dla HotPay.
      if (paidRows.length > 0) {
        trackKpi(KpiEvents.checkoutCompleted, order.userId, {
          plan_sku: order.planSku,
          amount_grosze: order.amountGrosze,
        });
        await sendOrderConfirmation(db, order);
      }
    } else if (["cancelled", "failed", "expired", "amount_mismatch"].includes(order.status)) {
      // Płatność za zamówienie `cancelled`/`failed`/`expired`/`amount_mismatch`: do ręcznej obsługi
      // (księgowanie albo zwrot w panelu), tylko identyfikatory. Znacznik widoczny w widżecie alertów.
      if (order.status !== "amount_mismatch") {
        await db
          .update(subscriptionOrders)
          .set({ latePaymentAt: new Date(), hotpayPaymentId: idPlatnosci })
          .where(and(eq(subscriptionOrders.id, order.id), isNull(subscriptionOrders.latePaymentAt)));
      }
      logPaymentAlert("late_payment", `hotpay.notify: paid_${order.status}_order ${order.id} ${idPlatnosci}`);
    }
    return new NextResponse("OK", { status: 200 });
  }

  if (status === "FAILURE") {
    if (order.status === "pending") {
      await db
        .update(subscriptionOrders)
        .set({ status: "failed", hotpayPaymentId: idPlatnosci })
        .where(eq(subscriptionOrders.id, order.id));
    }
    return new NextResponse("OK", { status: 200 });
  }

  // PENDING — nic nie zmieniamy
  return new NextResponse("OK", { status: 200 });
}

export const POST = withApiErrors(handlePOST);
