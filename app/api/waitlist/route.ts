import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { sendWaitlistConfirmEmail } from "@/lib/email";
import { checkRateLimitAsync, clientIpFromHeaders } from "@/lib/rate-limit";
import {
  allowedWaitlistOrigins,
  isWaitlistConfigured,
  registerWaitlistSignup,
  unsubscribeToken,
  waitlistCorsHeaders,
  waitlistSchema,
} from "@/lib/waitlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Publiczny adres aplikacji do linków w e-mailu (nie `req.url`: za proxy bywa localhost). */
function appOrigin(req: Request): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  try {
    if (raw) return new URL(raw).origin;
  } catch {
    /* użyj adresu żądania */
  }
  return new URL(req.url).origin;
}

function json(body: Record<string, unknown>, status: number, cors: Record<string, string>, extra?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...cors, ...extra } });
}

/** Preflight CORS — tylko dla domeny landingu. */
export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  const cors = waitlistCorsHeaders(origin);
  if (!origin || !cors["Access-Control-Allow-Origin"]) return new NextResponse(null, { status: 403, headers: cors });
  return new NextResponse(null, { status: 204, headers: cors });
}

/**
 * Zapis na powiadomienie o premierze w Google Play (z landingu). Publiczne, bez sesji i bez CSRF-cookie
 * (żądanie jest cross-origin) — ochrona: ścisły Origin, jawna zgoda, honeypot, rate limit IP + e-mail,
 * jednolita odpowiedź (brak ujawniania, czy adres już jest na liście), double opt-in.
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const cors = waitlistCorsHeaders(origin);

  if (!isWaitlistConfigured()) {
    return json({ ok: false, error: "Zapisy są chwilowo niedostępne." }, 503, cors);
  }
  if (!origin || !allowedWaitlistOrigins().has(origin)) {
    return json({ ok: false, error: "Niedozwolone źródło żądania." }, 403, cors);
  }

  const ip = clientIpFromHeaders(req.headers);
  const rlIp = await checkRateLimitAsync(`waitlist-ip:${ip}`, 5, 60 * 60_000);
  if (!rlIp.ok) {
    return json({ ok: false, error: "Zbyt wiele prób. Spróbuj później." }, 429, cors, { "Retry-After": String(rlIp.retryAfterSec) });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Nieprawidłowe dane." }, 400, cors);
  }
  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    return json({ ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane." }, 400, cors);
  }
  const { email, website } = parsed.data;

  // Honeypot: udajemy sukces, nic nie zapisujemy i nie wysyłamy.
  if (website) return json({ ok: true }, 200, cors);

  const rlEmail = await checkRateLimitAsync(`waitlist-email:${email}`, 3, 60 * 60_000);
  if (!rlEmail.ok) return json({ ok: true }, 200, cors);

  try {
    await ensureCriticalSchema();
    const outcome = await registerWaitlistSignup(getDb(), email);
    if (outcome.kind === "send-confirmation") {
      const base = appOrigin(req);
      const unsub = unsubscribeToken(email);
      const confirmUrl = `${base}/api/waitlist/confirm?token=${encodeURIComponent(outcome.token)}`;
      const unsubscribeUrl = unsub
        ? `${base}/api/waitlist/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(unsub)}`
        : `${base}/pomoc`;
      const sent = await sendWaitlistConfirmEmail({ to: email, confirmUrl, unsubscribeUrl });
      if (!sent) {
        return json({ ok: false, error: "Nie udało się wysłać e-maila potwierdzającego. Spróbuj później." }, 503, cors);
      }
    }
  } catch (err) {
    // Bez adresu e-mail i treści błędu w logach (dane osobowe).
    console.error("[waitlist] zapis nieudany:", err instanceof Error ? err.name : "unknown");
    return json({ ok: false, error: "Coś poszło nie tak. Spróbuj później." }, 500, cors);
  }

  // Ta sama odpowiedź niezależnie od tego, czy adres był już na liście.
  return json({ ok: true }, 200, cors);
}
