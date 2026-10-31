"use server";

import { hash } from "bcryptjs";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { getDb } from "@/db";
import { emailVerificationCodes, users } from "@/db/schema";
import { currentClientIp, guardAction } from "@/lib/action-guard";
import { sendPasswordResetCodeEmail } from "@/lib/email";
import { AppError } from "@/lib/errors/app-error";
import { checkRateLimitAsync, RATE } from "@/lib/rate-limit";
import { getRegisterEmailMode, TEST_REGISTER_CODE } from "@/lib/register-email-mode";
import { logAuthFailure, securityEventInsert } from "@/lib/security-events";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/password-reset";

export type ResetErrorCode =
  | "reset_unavailable"
  | "rate_limited"
  | "invalid_form"
  | "code_invalid"
  | "code_expired";

export type ForgotPasswordState =
  | { ok: true; mode: "smtp" | "test" }
  | { ok: false; code: ResetErrorCode; error: string };

export type ResetPasswordState =
  | { ok: true }
  | {
      ok: false;
      code: ResetErrorCode;
      error: string;
      attemptsLeft?: number;
      fieldErrors?: { email?: string[]; code?: string[]; password?: string[] };
    };

const MESSAGES: Record<ResetErrorCode, string> = {
  reset_unavailable: "Zmiana hasła e-mailem jest teraz niedostępna. Spróbuj później.",
  rate_limited: "Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.",
  invalid_form: "Sprawdź zaznaczone pola formularza.",
  code_invalid: "Nieprawidłowy kod.",
  code_expired: "Kod wygasł albo wykorzystano limit prób. Wyślij nowy kod.",
};

function fail(code: ResetErrorCode): { ok: false; code: ResetErrorCode; error: string } {
  return { ok: false, code, error: MESSAGES[code] };
}

const PURPOSE = "reset_password";
const CODE_VALID_MINUTES = 10;
const RESEND_INTERVAL_MS = 60_000;
const CODE_RETENTION_MS = 24 * 60 * 60_000;
const MAX_CODE_ATTEMPTS = 5;

function codeSecret(): string {
  const secret =
    process.env.EMAIL_CODE_SECRET ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Missing EMAIL_CODE_SECRET (or AUTH_SECRET).");
  return secret;
}

/** Skrót jak przy rejestracji, ale z celem w soli — kod rejestracji nie zadziała przy resecie. */
function hashCode(code: string): string {
  return createHash("sha256").update(`${codeSecret()}:${PURPOSE}:${code}`).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

async function hitLimits(kind: "send" | "submit", email: string): Promise<boolean> {
  const ip = await currentClientIp();
  const ipLimit = kind === "send" ? RATE.resetSendCodeIp : RATE.resetSubmitIp;
  const emailLimit = kind === "send" ? RATE.resetSendCodeEmail : RATE.resetSubmitEmail;
  const [byIp, byEmail] = await Promise.all([
    checkRateLimitAsync(`reset-${kind}-ip:${ip}`, ipLimit.limit, ipLimit.windowMs),
    checkRateLimitAsync(`reset-${kind}-email:${email}`, emailLimit.limit, emailLimit.windowMs),
  ]);
  return byIp.ok && byEmail.ok;
}

/**
 * Wysyła kod do zmiany hasła. Odpowiedź jest taka sama, gdy konto istnieje i gdy nie —
 * nie da się tym sprawdzić, kto ma konto w GymBrat. Cooldown 60 s pilnuje UI; serwer
 * przy zbyt wczesnym ponowieniu po prostu nie wysyła kolejnej wiadomości.
 */
export async function requestPasswordReset(input: unknown): Promise<ForgotPasswordState> {
  await guardAction("auth.requestPasswordReset", { limit: 10, windowMs: 3600000 });
  const mode = getRegisterEmailMode();
  if (mode === "disabled") return fail("reset_unavailable");

  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_form");
  const email = parsed.data.email.toLowerCase();
  if (!(await hitLimits("send", email))) return fail("rate_limited");

  const db = getDb();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) return { ok: true, mode };

  const now = new Date();
  await db
    .delete(emailVerificationCodes)
    .where(lt(emailVerificationCodes.createdAt, new Date(now.getTime() - CODE_RETENTION_MS)));

  const [recent] = await db
    .select({ lastSentAt: emailVerificationCodes.lastSentAt })
    .from(emailVerificationCodes)
    .where(
      and(
        eq(emailVerificationCodes.email, email),
        eq(emailVerificationCodes.purpose, PURPOSE),
        isNull(emailVerificationCodes.consumedAt),
      ),
    )
    .orderBy(desc(emailVerificationCodes.createdAt))
    .limit(1);
  if (recent && now.getTime() - recent.lastSentAt.getTime() < RESEND_INTERVAL_MS) {
    return { ok: true, mode };
  }

  const code = mode === "test" ? TEST_REGISTER_CODE : String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeId = crypto.randomUUID();

  await db
    .delete(emailVerificationCodes)
    .where(and(eq(emailVerificationCodes.email, email), eq(emailVerificationCodes.purpose, PURPOSE)));
  await db.insert(emailVerificationCodes).values({
    id: codeId,
    email,
    purpose: PURPOSE,
    codeHash: hashCode(code),
    expiresAt: new Date(now.getTime() + CODE_VALID_MINUTES * 60_000),
    createdAt: now,
    consumedAt: null,
    sendCount: 1,
    attemptCount: 0,
    lastSentAt: now,
  });

  if (mode === "test") return { ok: true, mode };

  try {
    await sendPasswordResetCodeEmail({ to: email, code, minutesValid: CODE_VALID_MINUTES });
  } catch (err) {
    logAuthFailure("auth.requestPasswordReset.smtp", err);
    await db.delete(emailVerificationCodes).where(eq(emailVerificationCodes.id, codeId));
    // Błąd wysyłki zdarza się tylko dla istniejących kont — gdybyśmy go zwrócili, ujawnilibyśmy
    // istnienie konta. Awaria jest w logach; użytkownik zamówi kod ponownie po 60 s.
  }
  return { ok: true, mode };
}

export async function resetPassword(input: unknown): Promise<ResetPasswordState> {
  await guardAction("auth.resetPassword", { limit: 20, windowMs: 3600000 });
  const mode = getRegisterEmailMode();
  if (mode === "disabled") return fail("reset_unavailable");

  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ...fail("invalid_form"), fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;
  const email = data.email.toLowerCase();
  if (!(await hitLimits("submit", email))) return fail("rate_limited");

  const db = getDb();
  const now = new Date();

  const [row] = await db
    .select()
    .from(emailVerificationCodes)
    .where(
      and(
        eq(emailVerificationCodes.email, email),
        eq(emailVerificationCodes.purpose, PURPOSE),
        isNull(emailVerificationCodes.consumedAt),
      ),
    )
    .orderBy(desc(emailVerificationCodes.createdAt))
    .limit(1);

  // Brak kodu = brak konta albo kod nie został wysłany; ta sama odpowiedź w obu przypadkach.
  if (!row || row.expiresAt.getTime() < now.getTime() || row.attemptCount >= MAX_CODE_ATTEMPTS) {
    return fail("code_expired");
  }

  // Próba jest zużywana atomowo PRZED porównaniem — równoległe zgadywanie nie obejdzie limitu.
  const consumed = await db
    .update(emailVerificationCodes)
    .set({ attemptCount: sql`${emailVerificationCodes.attemptCount} + 1` })
    .where(
      and(
        eq(emailVerificationCodes.id, row.id),
        lt(emailVerificationCodes.attemptCount, MAX_CODE_ATTEMPTS),
        isNull(emailVerificationCodes.consumedAt),
      ),
    )
    .returning({ id: emailVerificationCodes.id });
  if (consumed.length === 0) return fail("code_expired");

  if (!safeEqualHex(hashCode(data.code), row.codeHash)) {
    const left = MAX_CODE_ATTEMPTS - (row.attemptCount + 1);
    if (left <= 0) return fail("code_expired");
    return {
      ok: false,
      code: "code_invalid",
      error: left === 1 ? "Nieprawidłowy kod. Została 1 próba." : `Nieprawidłowy kod. Zostało prób: ${left}.`,
      attemptsLeft: left,
    };
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) return fail("code_expired");

  const passwordHash = await hash(data.password, 12);
  try {
    // Jedna transakcja: nowe hasło, unieważnienie sesji (session_version), zużycie kodu, audyt.
    await db.batch([
      db
        .update(users)
        .set({
          passwordHash,
          sessionVersion: sql`${users.sessionVersion} + 1`,
          // Dostęp do skrzynki udowodniony kodem z e-maila (nie w trybie testowym).
          ...(mode === "smtp" ? { emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, ${now.getTime()})` } : {}),
        })
        .where(eq(users.id, user.id)),
      db.delete(emailVerificationCodes).where(eq(emailVerificationCodes.id, row.id)),
      securityEventInsert(db, {
        type: "password_reset",
        userId: user.id,
        reason: mode === "smtp" ? "email_code" : "test_mode",
      }),
    ]);
  } catch (err) {
    logAuthFailure("auth.resetPassword", err);
    throw new AppError("INTERNAL");
  }
  return { ok: true };
}
