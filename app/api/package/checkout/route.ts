import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { subscriptionOrders } from "@/db/schema";
import { assertCsrf } from "@/lib/csrf";
import {
  buildHotpayPaymentHash,
  formatHotpayKwota,
  hotpayConfigured,
  hotpayPaymentUrl,
  hotpaySekret,
} from "@/lib/hotpay";
import { checkRateLimitAsync, RATE } from "@/lib/rate-limit";
import { getSubscriptionPlanBySku } from "@/lib/subscription-plans";

export const runtime = "nodejs";

const bodySchema = z.object({
  sku: z.string().trim().min(1).max(32),
});

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak autoryzacji" }, { status: 401 });
  }

  if (!hotpayConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Płatności nie są jeszcze skonfigurowane. Spróbuj później.",
      },
      { status: 503 },
    );
  }

  const rl = await checkRateLimitAsync(
    `package-checkout:${session.user.id}`,
    RATE.adminMutation.limit,
    RATE.adminMutation.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Zbyt wiele prób. Spróbuj za chwilę." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Nieprawidłowy JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Wybierz pakiet." }, { status: 400 });
  }

  const plan = await getSubscriptionPlanBySku(parsed.data.sku);
  if (!plan || plan.active !== 1) {
    return NextResponse.json(
      { ok: false, error: "Ten pakiet jest niedostępny." },
      { status: 404 },
    );
  }

  await ensureCriticalSchema();
  const db = getDb();
  const [order] = await db
    .insert(subscriptionOrders)
    .values({
      userId: session.user.id,
      planId: plan.id,
      planSku: plan.sku,
      days: plan.days,
      amountGrosze: plan.priceGrosze,
      status: "pending",
      source: "hotpay",
    })
    .returning({ id: subscriptionOrders.id });

  if (!order?.id) {
    return NextResponse.json(
      { ok: false, error: "Nie udało się utworzyć zamówienia." },
      { status: 500 },
    );
  }

  const origin = new URL(req.url).origin;
  const returnUrl = `${origin}/package?paid=1&order=${encodeURIComponent(order.id)}`;
  const kwota = formatHotpayKwota(plan.priceGrosze);
  const nazwa = `GymBrat — ${plan.title}`.slice(0, 120);
  const sekret = hotpaySekret();
  const hash = buildHotpayPaymentHash({
    kwota,
    nazwaUslugi: nazwa,
    adresWww: returnUrl,
    idZamowienia: order.id,
  });

  return NextResponse.json({
    ok: true,
    paymentUrl: hotpayPaymentUrl(),
    fields: {
      SEKRET: sekret,
      KWOTA: kwota,
      NAZWA_USLUGI: nazwa,
      ADRES_WWW: returnUrl,
      ID_ZAMOWIENIA: order.id,
      EMAIL: session.user.email ?? "",
      HASH: hash,
    },
  });
}
