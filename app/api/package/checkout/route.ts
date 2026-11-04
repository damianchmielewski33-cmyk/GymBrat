import { trackKpi, KpiEvents } from "@/lib/analytics/track-kpi";
import { withApiErrors } from "@/lib/errors/api";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { subscriptionOrders, users } from "@/db/schema";
import { assertCsrf } from "@/lib/csrf";
import {
  buildHotpayPaymentHash,
  formatHotpayKwota,
  hotpayConfigured,
  hotpayPaymentUrl,
  hotpaySekret,
} from "@/lib/hotpay";
import { isPackageCheckoutEnabled } from "@/lib/feature-flags";
import { MIN_PURCHASE_AGE } from "@/lib/min-age";
import {
  ORDER_CONSENT_REQUIRED_MESSAGE,
  ORDER_TERMS_VERSION,
  orderConsentCanonicalText,
} from "@/lib/order-consents";
import { findReusablePendingOrder } from "@/lib/order-admin";
import { checkRateLimitAsync, RATE } from "@/lib/rate-limit";
import { getSubscriptionPlanBySku } from "@/lib/subscription-plans";

export const runtime = "nodejs";

const bodySchema = z.object({
  sku: z.string().trim().min(1).max(32),
  /** Z6: obie zgody wymagane po stronie serwera (UI tylko je przekazuje). */
  termsAccepted: z.boolean().optional(),
  immediateServiceConsent: z.boolean().optional(),
});

async function handlePOST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak autoryzacji" }, { status: 401 });
  }

  if (!isPackageCheckoutEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Zakup pakietu będzie dostępny wkrótce." },
      { status: 503 },
    );
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
    RATE.checkout.limit,
    RATE.checkout.windowMs,
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

  if (parsed.data.termsAccepted !== true || parsed.data.immediateServiceConsent !== true) {
    return NextResponse.json(
      { ok: false, error: ORDER_CONSENT_REQUIRED_MESSAGE },
      { status: 400 },
    );
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

  // Z13: pakiet można kupić od 18 lat (zakup przez osobę z ograniczoną zdolnością do czynności prawnych).
  const [buyer] = await db
    .select({ age: users.age })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (buyer?.age != null && buyer.age < MIN_PURCHASE_AGE) {
    return NextResponse.json(
      { ok: false, error: `Pakiet Premium można kupić od ${MIN_PURCHASE_AGE}. roku życia.` },
      { status: 403 },
    );
  }

  // Z22: ponowne kliknięcie w 15 min używa istniejącego `pending` (ta sama kwota), zamiast mnożyć zamówienia.
  const reusedId = await findReusablePendingOrder(db, {
    userId: session.user.id,
    planSku: plan.sku,
    amountGrosze: plan.priceGrosze,
  });

  const acceptedAt = new Date();
  const [order] = reusedId
    ? [{ id: reusedId }]
    : await db
    .insert(subscriptionOrders)
    .values({
      userId: session.user.id,
      planId: plan.id,
      planSku: plan.sku,
      days: plan.days,
      amountGrosze: plan.priceGrosze,
      status: "pending",
      source: "hotpay",
      // Z6: dowód zgód konsumenckich (czas, wersja, skrót dokładnego tekstu).
      termsAcceptedAt: acceptedAt,
      immediateServiceConsentAt: acceptedAt,
      termsVersion: ORDER_TERMS_VERSION,
      consentTextHash: createHash("sha256").update(orderConsentCanonicalText(), "utf8").digest("hex"),
    })
    .returning({ id: subscriptionOrders.id });

  if (!order?.id) {
    return NextResponse.json(
      { ok: false, error: "Nie udało się utworzyć zamówienia." },
      { status: 500 },
    );
  }

  if (!reusedId) {
    trackKpi(KpiEvents.checkoutStarted, session.user.id, {
      plan_sku: plan.sku,
      amount_grosze: plan.priceGrosze,
    });
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

export const POST = withApiErrors(handlePOST);
