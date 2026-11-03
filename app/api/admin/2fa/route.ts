import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { users } from "@/db/schema";
import { requireAdminApi } from "@/lib/admin-api";
import {
  beginAdmin2faSetup,
  disableAdmin2fa,
  enableAdmin2fa,
  getAdmin2faStatus,
  regenerateRecoveryCodes,
  verifyAdmin2fa,
  type Admin2faFailure,
} from "@/lib/admin-2fa";
import {
  ADMIN_2FA_COOKIE,
  isAdmin2faRequired,
  readAdmin2faVerified,
  signAdmin2faToken,
} from "@/lib/admin-session";
import { assertCsrf } from "@/lib/csrf";
import { sendAdminLoginEmail } from "@/lib/email";
import { withApiErrors } from "@/lib/errors/api";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-events";

export const runtime = "nodejs";

const COOKIE_MAX_AGE_SEC = 12 * 60 * 60;

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("setup") }),
  z.object({ action: z.literal("enable"), code: z.string().trim().min(6).max(32) }),
  z.object({ action: z.literal("verify"), code: z.string().trim().min(6).max(32) }),
  z.object({ action: z.literal("disable"), code: z.string().trim().min(6).max(32) }),
  z.object({ action: z.literal("regenerate"), code: z.string().trim().min(6).max(32) }),
  z.object({ action: z.literal("leave") }),
]);

function failureResponse(f: Admin2faFailure) {
  if (f.reason === "locked") {
    const retryAfterSec = Math.max(1, Math.ceil((f.lockedUntil - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Zbyt wiele błędnych kodów. Spróbuj za kilka minut.", lockedUntil: f.lockedUntil },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }
  if (f.reason === "not_enrolled") {
    return NextResponse.json({ error: "2FA nie jest skonfigurowane." }, { status: 409 });
  }
  return NextResponse.json({ error: "Nieprawidłowy kod.", attemptsLeft: f.attemptsLeft }, { status: 400 });
}

function setVerifiedCookie(res: NextResponse, userId: string) {
  res.cookies.set(ADMIN_2FA_COOKIE, signAdmin2faToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SEC,
  });
}

/** Status 2FA bieżącego admina (bez wymogu 2FA — to właśnie tu się je konfiguruje). */
async function handleGET() {
  const gate = await requireAdminApi({ skip2fa: true });
  if (!gate.ok) return gate.response;
  await ensureCriticalSchema();
  const userId = gate.session.user!.id!;
  const status = await getAdmin2faStatus(getDb(), userId);
  return NextResponse.json({
    ok: true,
    ...status,
    required: isAdmin2faRequired(),
    verified: await readAdmin2faVerified(gate.session),
  });
}

async function handlePOST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;
  const gate = await requireAdminApi({ skip2fa: true });
  if (!gate.ok) return gate.response;

  const rl = await checkRateLimitAsync(rateLimitKey("admin-2fa", req), RATE.adminUnlock.limit, RATE.adminUnlock.windowMs);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Zbyt wiele prób. Spróbuj za chwilę." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });

  await ensureCriticalSchema();
  const db = getDb();
  const userId = gate.session.user!.id!;
  const body = parsed.data;

  if (body.action === "leave") {
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(ADMIN_2FA_COOKIE);
    return res;
  }

  if (body.action === "setup") {
    const [me] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    const setup = await beginAdmin2faSetup(db, { userId, account: me?.email ?? "admin" });
    if (!setup) return NextResponse.json({ error: "2FA jest już włączone." }, { status: 409 });
    return NextResponse.json({ ok: true, secret: setup.secret, uri: setup.uri });
  }

  if (body.action === "enable") {
    const r = await enableAdmin2fa(db, { userId, code: body.code });
    if (!r.ok) return failureResponse(r);
    await logSecurityEvent({ type: "admin_2fa_enabled", userId });
    const res = NextResponse.json({ ok: true, recoveryCodes: r.recoveryCodes });
    setVerifiedCookie(res, userId);
    return res;
  }

  if (body.action === "verify") {
    const r = await verifyAdmin2fa(db, { userId, code: body.code });
    if (!r.ok) {
      if (r.reason === "locked") await logSecurityEvent({ type: "admin_2fa_locked", userId });
      else if (r.reason === "invalid") await logSecurityEvent({ type: "admin_2fa_failed", userId });
      return failureResponse(r);
    }
    await logSecurityEvent({ type: "admin_2fa_verified", userId, reason: r.usedRecoveryCode ? "recovery_code" : "totp" });
    // Powiadomienie o logowaniu admina — best-effort (wymaga SMTP), nie blokuje wejścia.
    const email = gate.session.user?.email;
    if (email) {
      void sendAdminLoginEmail({ to: email, at: new Date(), usedRecoveryCode: r.usedRecoveryCode }).catch(() => false);
    }
    const res = NextResponse.json({ ok: true, usedRecoveryCode: r.usedRecoveryCode });
    setVerifiedCookie(res, userId);
    return res;
  }

  if (body.action === "regenerate") {
    const r = await regenerateRecoveryCodes(db, { userId, code: body.code });
    if (!r.ok) return failureResponse(r);
    return NextResponse.json({ ok: true, recoveryCodes: r.recoveryCodes });
  }

  // disable
  const r = await disableAdmin2fa(db, { userId, code: body.code });
  if (!r.ok) return failureResponse(r);
  await logSecurityEvent({ type: "admin_2fa_disabled", userId });
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_2FA_COOKIE);
  return res;
}

export const GET = withApiErrors(handleGET);
export const POST = withApiErrors(handlePOST);
