import { withApiErrors } from "@/lib/errors/api";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { subscriptionOrders } from "@/db/schema";
import { AppError } from "@/lib/errors/app-error";
import { logServerError, newRequestId } from "@/lib/errors/server-log";
import { verifyHotpayNotificationHash } from "@/lib/hotpay";
import { extendUserPackage } from "@/lib/user-package";

export const runtime = "nodejs";

/**
 * Webhook HotPay (form-data POST).
 * W panelu HotPay ustaw: https://TWOJA-DOMENA/api/payments/hotpay/notify
 */
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
    // Pakiet tylko przy faktycznym przejściu `pending` → `paid`: powtórzone notify (już `paid`),
    // zamówienie anulowane (np. przy przejęciu konta, ADR 0001 D4) i `failed` nie przedłużają pakietu.
    const changed = await db
      .update(subscriptionOrders)
      .set({
        status: "paid",
        hotpayPaymentId: idPlatnosci,
        paidAt: new Date(),
      })
      .where(
        and(
          eq(subscriptionOrders.id, order.id),
          eq(subscriptionOrders.status, "pending"),
        ),
      )
      .returning({ id: subscriptionOrders.id });
    if (changed.length > 0) {
      await extendUserPackage({
        userId: order.userId,
        days: order.days,
        planSku: order.planSku,
      });
    } else if (order.status !== "paid" && order.status !== "pending") {
      // Płatność za zamówienie `cancelled`/`failed`: do ręcznej obsługi (zwrot), tylko identyfikatory.
      logServerError(
        new AppError("INTERNAL", {
          message: `hotpay.notify: paid_${order.status}_order ${order.id} ${idPlatnosci}`,
        }),
        { requestId: newRequestId(), origin: "hotpay.notify" },
      );
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
