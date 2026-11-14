"use server";

import { trackKpi, KpiEvents } from "@/lib/analytics/track-kpi";
import { currentClientIp, guardAction } from "@/lib/action-guard";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { getAnalyticsDeployment } from "@/lib/analytics-deployment";
import {
  siteActivityLog,
  userConsents,
  userSettings,
  users,
} from "@/db/schema";
import {
  CURRENT_CONSENT_TEXT_VERSION,
  SENSITIVE_CONSENT_TEXT_VERSION,
} from "@/lib/consents-client";
import {
  registerSchema,
  type RegisterInput,
} from "@/lib/validations/register";
import { fitnessGoalsToJson } from "@/lib/fitness-goals";
import { getRegisterActivationMode } from "@/lib/register-email-mode";
import { logAuthFailure, securityEventInsert } from "@/lib/security-events";
import { AppError } from "@/lib/errors/app-error";
import { checkRateLimitAsync, RATE } from "@/lib/rate-limit";

export type RegisterErrorCode =
  | "registration_disabled"
  | "rate_limited"
  | "invalid_form"
  | "account_exists";

export type RegisterState =
  | { ok: true }
  | {
      ok: false;
      code: RegisterErrorCode;
      error: string;
      fieldErrors?: Partial<Record<keyof RegisterInput, string[]>>;
    };

const REGISTER_ERROR_MESSAGES: Record<RegisterErrorCode, string> = {
  registration_disabled: "Rejestracja e-mailem jest teraz niedostępna. Wróć i wybierz inną metodę.",
  rate_limited: "Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.",
  invalid_form: "Sprawdź zaznaczone pola formularza.",
  account_exists: "Konto z tym e-mailem już istnieje. Zaloguj się.",
};

function fail(code: RegisterErrorCode): { ok: false; code: RegisterErrorCode; error: string } {
  return { ok: false, code, error: REGISTER_ERROR_MESSAGES[code] };
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

async function hitRegisterLimit(email: string): Promise<boolean> {
  const ip = await currentClientIp();
  const [byIp, byEmail] = await Promise.all([
    checkRateLimitAsync(
      `register-submit-ip:${ip}`,
      RATE.registerSubmitIp.limit,
      RATE.registerSubmitIp.windowMs,
    ),
    checkRateLimitAsync(
      `register-submit-email:${email}`,
      RATE.registerSubmitEmail.limit,
      RATE.registerSubmitEmail.windowMs,
    ),
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

/**
 * Rejestracja e-mailem. Konto jest aktywne od razu (`instant`) i zostaje z niezweryfikowanym adresem
 * (`emailVerifiedAt = NULL`) — potwierdzanie linkiem z e-maila dojdzie po skonfigurowaniu SMTP.
 * Pomiary startowe i zdjęcie klient zapisuje po zalogowaniu przez `/api/body-reports` (te same
 * zgody i limity co zwykły raport sylwetki).
 */
export async function registerUser(
  input: unknown,
): Promise<RegisterState> {
  await guardAction("auth.registerUser", { limit: 20, windowMs: 3600000 });
  const mode = getRegisterActivationMode();
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

  if (!(await hitRegisterLimit(email))) return fail("rate_limited");
  if (await findUserIdByEmail(email)) return fail("account_exists");

  const db = getDb();
  const now = new Date();
  const passwordHash = await hash(data.password, 12);
  const userId = crypto.randomUUID();
  const displayName = `${data.firstName} ${data.lastName}`.trim();

  const consentRows: (typeof userConsents.$inferInsert)[] = [
    {
      userId,
      type: "age_16",
      granted: true,
      textVersion: CURRENT_CONSENT_TEXT_VERSION,
      source: "registration",
      decidedAt: now,
    },
    ...(["health", "photos"] as const)
      .filter((t) => (t === "health" ? data.healthConsent : data.photosConsent))
      .map((type) => ({
        userId,
        type,
        granted: true,
        textVersion: SENSITIVE_CONSENT_TEXT_VERSION,
        source: "registration",
        decidedAt: now,
      })),
  ];

  try {
    // Jeden batch (transakcja): konto, ustawienia, zgody i zdarzenie (LR-26).
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
        // Adres niepotwierdzony (LR-21): nie daje uprawnień admina i można go przejąć przez Google.
        emailVerifiedAt: null,
        createdAt: now,
      }),
      db.insert(userSettings).values(newUserSettingsRow(userId, data.weeklySessionsTarget)),
      // Z13 + Z11: oświadczenie o wieku 16+ i opcjonalne zgody z ekranu rejestracji — jeden insert
      // (zawsze niepusty dzięki oświadczeniu), w tej samej transakcji co konto.
      db.insert(userConsents).values(consentRows),
      securityEventInsert(db, {
        type: "register",
        userId,
        reason: mode,
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

  trackKpi(KpiEvents.userRegistered, userId, { role: data.role });
  return { ok: true };
}
