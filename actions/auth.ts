"use server";

import { currentClientIp, guardAction } from "@/lib/action-guard";
import { hash } from "bcryptjs";
import { eq, sql, and, desc, isNull, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { getAnalyticsDeployment } from "@/lib/analytics-deployment";
import {
  emailVerificationCodes,
  siteActivityLog,
  userSettings,
  users,
} from "@/db/schema";
import {
  registerSchema,
  type RegisterInput,
} from "@/lib/validations/register";
import { fitnessGoalsToJson } from "@/lib/fitness-goals";
import { sendRegisterVerificationCodeEmail } from "@/lib/email";
import { getRegisterEmailMode, TEST_REGISTER_CODE } from "@/lib/register-email-mode";
import { logAuthFailure, securityEventInsert } from "@/lib/security-events";
import { AppError } from "@/lib/errors/app-error";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { checkRateLimitAsync, RATE } from "@/lib/rate-limit";
import { z } from "zod";

export type RegisterErrorCode =
  | "registration_disabled"
  | "rate_limited"
  | "invalid_email"
  | "invalid_form"
  | "account_exists"
  | "code_resend_too_soon"
  | "code_missing"
  | "code_expired"
  | "code_invalid"
  | "code_attempts_exhausted"
  | "send_failed";

export type SendRegisterCodeState =
  | { ok: true; mode: "smtp" | "test" }
  | { ok: false; code: RegisterErrorCode; error: string };

export type RegisterState =
  | { ok: true }
  | {
      ok: false;
      code: RegisterErrorCode;
      error: string;
      attemptsLeft?: number;
      fieldErrors?: Partial<Record<keyof RegisterInput, string[]>>;
    };

const REGISTER_ERROR_MESSAGES: Record<RegisterErrorCode, string> = {
  registration_disabled: "Rejestracja e-mailem jest teraz niedostępna. Wróć i wybierz inną metodę.",
  rate_limited: "Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.",
  invalid_email: "Wpisz poprawny adres e-mail.",
  invalid_form: "Sprawdź zaznaczone pola formularza.",
  account_exists: "Konto z tym e-mailem już istnieje. Zaloguj się.",
  code_resend_too_soon: "Nowy kod możesz zamówić za chwilę.",
  code_missing: "Najpierw wyślij kod weryfikacyjny i wpisz go w formularzu.",
  code_expired: "Kod wygasł albo wykorzystano limit prób. Wyślij nowy kod.",
  code_invalid: "Nieprawidłowy kod.",
  code_attempts_exhausted: "Kod wygasł albo wykorzystano limit prób. Wyślij nowy kod.",
  send_failed: "Nie udało się wysłać kodu. Spróbuj ponownie za chwilę.",
};

function fail(code: RegisterErrorCode): { ok: false; code: RegisterErrorCode; error: string } {
  return { ok: false, code, error: REGISTER_ERROR_MESSAGES[code] };
}

/** "Zostały 3 próby." / "Została 1 próba." / "Zostało 5 prób." */
function attemptsLeftMessage(left: number): string {
  if (left === 1) return "Nieprawidłowy kod. Została 1 próba.";
  const mod10 = left % 10;
  const mod100 = left % 100;
  const few = mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14);
  return few
    ? `Nieprawidłowy kod. Zostały ${left} próby.`
    : `Nieprawidłowy kod. Zostało ${left} prób.`;
}

function newUserSettingsRow(
  userId: string,
  weeklySessionsTarget: number,
) {
  return {
    userId,
    weeklyCardioGoalMinutes: 150,
    fitnessGoalsJson: fitnessGoalsToJson({ weeklySessionsTarget }),
    /** Cel tygodnia zebrany w rejestracji — bez ponownego banera onboardingu. */
    onboardingCompletedAt: new Date(),
  };
}

const sendRegisterCodeSchema = z.object({
  email: z.string().trim().email("Wpisz poprawny adres e-mail"),
});

const REGISTER_PURPOSE = "register";
const CODE_VALID_MINUTES = 10;
const RESEND_INTERVAL_MS = 60_000;
/** LR-20: niewykorzystane kody najpóźniej po 24 h (także bez crona). */
const CODE_RETENTION_MS = 24 * 60 * 60_000;

function getEmailCodeSecret(): string {
  const secret = process.env.EMAIL_CODE_SECRET ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "Missing EMAIL_CODE_SECRET (or AUTH_SECRET). This is required to hash verification codes safely on production.",
    );
  }
  return secret;
}

function hashEmailCode(code: string): string {
  const secret = getEmailCodeSecret();
  return createHash("sha256").update(`${secret}:${code}`).digest("hex");
}

function generate6DigitCode(): string {
  const n = randomInt(0, 1_000_000);
  return String(n).padStart(6, "0");
}

/** Maksymalna liczba prób wpisania kodu na jeden wysłany kod (potem trzeba zamówić nowy). */
const MAX_REGISTER_CODE_ATTEMPTS = 5;

/** Porównanie skrótów w stałym czasie (bez wycieku przez czas odpowiedzi). */
function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Atomowo zużywa jedną próbę wpisania kodu. Zwraca `false`, gdy limit jest już wyczerpany —
 * warunek `attempt_count < MAX` jest w samym `UPDATE`, więc równoległe żądania nie obejdą limitu.
 */
async function consumeCodeAttempt(
  db: ReturnType<typeof getDb>,
  codeId: string,
): Promise<boolean> {
  const rows = await db
    .update(emailVerificationCodes)
    .set({ attemptCount: sql`${emailVerificationCodes.attemptCount} + 1` })
    .where(
      and(
        eq(emailVerificationCodes.id, codeId),
        lt(emailVerificationCodes.attemptCount, MAX_REGISTER_CODE_ATTEMPTS),
        isNull(emailVerificationCodes.consumedAt),
      ),
    )
    .returning({ id: emailVerificationCodes.id });
  return rows.length > 0;
}

async function hitRegisterLimits(
  kind: "send" | "submit",
  email: string,
): Promise<boolean> {
  const ip = await currentClientIp();
  const ipLimit = kind === "send" ? RATE.registerSendCodeIp : RATE.registerSubmitIp;
  const emailLimit = kind === "send" ? RATE.registerSendCodeEmail : RATE.registerSubmitEmail;
  const [byIp, byEmail] = await Promise.all([
    checkRateLimitAsync(`register-${kind}-ip:${ip}`, ipLimit.limit, ipLimit.windowMs),
    checkRateLimitAsync(`register-${kind}-email:${email}`, emailLimit.limit, emailLimit.windowMs),
  ]);
  return byIp.ok && byEmail.ok;
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row?.id ?? null;
}

export async function sendRegisterCode(input: unknown): Promise<SendRegisterCodeState> {
  await guardAction("auth.sendRegisterCode", { limit: 10, windowMs: 3600000 });
  const mode = getRegisterEmailMode();
  if (mode === "disabled") return fail("registration_disabled");

  const parsed = sendRegisterCodeSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_email");

  const email = parsed.data.email.toLowerCase();
  if (!(await hitRegisterLimits("send", email))) return fail("rate_limited");
  if (await findUserIdByEmail(email)) return fail("account_exists");

  const db = getDb();
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
        eq(emailVerificationCodes.purpose, REGISTER_PURPOSE),
        isNull(emailVerificationCodes.consumedAt),
      ),
    )
    .orderBy(desc(emailVerificationCodes.createdAt))
    .limit(1);
  if (recent && now.getTime() - recent.lastSentAt.getTime() < RESEND_INTERVAL_MS) {
    return fail("code_resend_too_soon");
  }

  // Tryb testowy różni się tylko transportem: kod idzie przez tę samą tabelę, limity i wygaśnięcie.
  const code = mode === "test" ? TEST_REGISTER_CODE : generate6DigitCode();
  const codeId = crypto.randomUUID();

  await db
    .delete(emailVerificationCodes)
    .where(
      and(
        eq(emailVerificationCodes.email, email),
        eq(emailVerificationCodes.purpose, REGISTER_PURPOSE),
      ),
    );
  await db.insert(emailVerificationCodes).values({
    id: codeId,
    email,
    purpose: REGISTER_PURPOSE,
    codeHash: hashEmailCode(code),
    expiresAt: new Date(now.getTime() + CODE_VALID_MINUTES * 60_000),
    createdAt: now,
    consumedAt: null,
    sendCount: 1,
    attemptCount: 0,
    lastSentAt: now,
  });

  if (mode === "test") return { ok: true, mode };

  try {
    await sendRegisterVerificationCodeEmail({
      to: email,
      code,
      minutesValid: CODE_VALID_MINUTES,
    });
  } catch (err) {
    // Bez adresu i kodu w logach; wiersz usuwamy, żeby nie blokował ponowienia przez 60 s.
    logAuthFailure("auth.sendRegisterCode.smtp", err);
    await db.delete(emailVerificationCodes).where(eq(emailVerificationCodes.id, codeId));
    return fail("send_failed");
  }
  return { ok: true, mode };
}

export async function registerUser(
  input: unknown,
): Promise<RegisterState> {
  await guardAction("auth.registerUser", { limit: 20, windowMs: 3600000 });
  const mode = getRegisterEmailMode();
  if (mode === "disabled") return fail("registration_disabled");

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Partial<
      Record<keyof RegisterInput, string[]>
    >;
    return { ...fail("invalid_form"), fieldErrors };
  }

  const data = parsed.data;
  const email = data.email.toLowerCase();

  if (!(await hitRegisterLimits("submit", email))) return fail("rate_limited");

  const db = getDb();
  const now = new Date();

  const [codeRow] = await db
    .select()
    .from(emailVerificationCodes)
    .where(
      and(
        eq(emailVerificationCodes.email, email),
        eq(emailVerificationCodes.purpose, REGISTER_PURPOSE),
        isNull(emailVerificationCodes.consumedAt),
      ),
    )
    .orderBy(desc(emailVerificationCodes.createdAt))
    .limit(1);

  if (!codeRow) return fail("code_missing");
  if (codeRow.expiresAt.getTime() < now.getTime()) return fail("code_expired");
  if (codeRow.attemptCount >= MAX_REGISTER_CODE_ATTEMPTS) return fail("code_attempts_exhausted");
  // Próba jest zużywana atomowo PRZED porównaniem — równoległe zgadywanie nie obejdzie limitu.
  if (!(await consumeCodeAttempt(db, codeRow.id))) return fail("code_attempts_exhausted");
  if (!safeEqualHex(hashEmailCode(data.emailCode), codeRow.codeHash)) {
    const left = MAX_REGISTER_CODE_ATTEMPTS - (codeRow.attemptCount + 1);
    if (left <= 0) return fail("code_attempts_exhausted");
    return {
      ok: false,
      code: "code_invalid",
      error: attemptsLeftMessage(left),
      attemptsLeft: left,
    };
  }

  if (await findUserIdByEmail(email)) return fail("account_exists");

  const passwordHash = await hash(data.password, 12);
  const userId = crypto.randomUUID();
  const displayName = `${data.firstName} ${data.lastName}`.trim();

  try {
    // Jeden batch (transakcja): konto, ustawienia, usunięcie kodu (LR-20) i zdarzenie (LR-26).
    await db.batch([
      db.insert(users).values({
        id: userId,
        email,
        passwordHash,
        name: displayName,
        firstName: data.firstName,
        lastName: data.lastName,
        weightKg: data.weightKg,
        heightCm: data.heightCm,
        age: data.age,
        activityLevel: data.activityLevel,
        appRole: data.role,
        // LR-21: konto z trybu testowego ma e-mail niezweryfikowany.
        emailVerifiedAt: mode === "smtp" ? now : null,
        createdAt: now,
      }),
      db.insert(userSettings).values(newUserSettingsRow(userId, data.weeklySessionsTarget)),
      db.delete(emailVerificationCodes).where(eq(emailVerificationCodes.id, codeRow.id)),
      securityEventInsert(db, {
        type: "register",
        userId,
        reason: mode === "smtp" ? "email_code" : "test_mode",
      }),
      db.insert(siteActivityLog).values({
        userId,
        action: "Rejestracja konta",
        metaJson: JSON.stringify({
          role: data.role,
          weeklySessionsTarget: data.weeklySessionsTarget,
        }),
        deploymentEnv: getAnalyticsDeployment(),
      }),
    ]);
  } catch (err) {
    // Równoległa rejestracja tym samym adresem — unikalność e-maila w batchu.
    if (isUniqueViolation(err)) return fail("account_exists");
    // Błąd Drizzle zawiera parametry (dane ciała, skrót hasła) — do logów idzie tylko typ błędu.
    logAuthFailure("auth.registerUser", err);
    throw new AppError("INTERNAL");
  }

  return { ok: true };
}
