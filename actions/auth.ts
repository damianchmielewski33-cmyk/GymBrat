"use server";

import { hash } from "bcryptjs";
import { eq, sql, and, desc, isNull } from "drizzle-orm";
import { getDb } from "@/db";
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
import { sendRegisterVerificationCodeEmail } from "@/lib/email";
import { createHash, randomInt } from "node:crypto";
import { z } from "zod";

export type RegisterState =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Partial<Record<keyof RegisterInput, string[]>> };

export type SendRegisterCodeState =
  | { ok: true }
  | { ok: false; error: string };

const sendRegisterCodeSchema = z.object({
  email: z.string().trim().email("Wpisz poprawny adres e-mail"),
});

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

export async function sendRegisterCode(input: unknown): Promise<SendRegisterCodeState> {
  const parsed = sendRegisterCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Wpisz poprawny adres e-mail." };
  }

  const email = parsed.data.email.toLowerCase();
  const db = getDb();

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existingUser) {
    return { ok: false, error: "Konto z tym e-mailem już istnieje. Zaloguj się." };
  }

  const now = new Date();
  const purpose = "register";

  const [recent] = await db
    .select()
    .from(emailVerificationCodes)
    .where(
      and(
        eq(emailVerificationCodes.email, email),
        eq(emailVerificationCodes.purpose, purpose),
        isNull(emailVerificationCodes.consumedAt),
      ),
    )
    .orderBy(desc(emailVerificationCodes.createdAt))
    .limit(1);

  if (recent) {
    const last = recent.lastSentAt instanceof Date ? recent.lastSentAt : new Date(recent.lastSentAt as unknown as number);
    const msSince = now.getTime() - last.getTime();
    if (msSince < 60_000) {
      return { ok: false, error: "Kod został wysłany przed chwilą. Spróbuj ponownie za moment." };
    }
  }

  const code = generate6DigitCode();
  const expiresAt = new Date(now.getTime() + 10 * 60_000);

  await db
    .delete(emailVerificationCodes)
    .where(and(eq(emailVerificationCodes.email, email), eq(emailVerificationCodes.purpose, purpose)));

  await db.insert(emailVerificationCodes).values({
    id: crypto.randomUUID(),
    email,
    purpose,
    codeHash: hashEmailCode(code),
    expiresAt,
    createdAt: now,
    consumedAt: null,
    sendCount: 1,
    attemptCount: 0,
    lastSentAt: now,
  });

  await sendRegisterVerificationCodeEmail({
    to: email,
    code,
    minutesValid: 10,
  });

  return { ok: true };
}

export async function registerUser(
  input: unknown,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Partial<
      Record<keyof RegisterInput, string[]>
    >;
    return {
      ok: false,
      error: "Invalid form data.",
      fieldErrors,
    };
  }

  const data = parsed.data;
  const email = data.email.toLowerCase();

  const db = getDb();

  const now = new Date();
  const purpose = "register";

  const [codeRow] = await db
    .select()
    .from(emailVerificationCodes)
    .where(
      and(
        eq(emailVerificationCodes.email, email),
        eq(emailVerificationCodes.purpose, purpose),
        isNull(emailVerificationCodes.consumedAt),
      ),
    )
    .orderBy(desc(emailVerificationCodes.createdAt))
    .limit(1);

  if (!codeRow) {
    return { ok: false, error: "Najpierw wyślij kod weryfikacyjny na e-mail i wpisz go w formularzu." };
  }
  if (codeRow.expiresAt.getTime() < now.getTime()) {
    return { ok: false, error: "Kod wygasł. Wyślij nowy kod i spróbuj ponownie." };
  }
  const expected = codeRow.codeHash;
  const providedHash = hashEmailCode(data.emailCode);
  if (providedHash !== expected) {
    try {
      await db
        .update(emailVerificationCodes)
        .set({ attemptCount: sql`${emailVerificationCodes.attemptCount} + 1` })
        .where(eq(emailVerificationCodes.id, codeRow.id));
    } catch {
      // best-effort
    }
    return { ok: false, error: "Nieprawidłowy kod weryfikacyjny." };
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    return { ok: false, error: "An account with this email already exists." };
  }

  const passwordHash = await hash(data.password, 12);
  const userId = crypto.randomUUID();
  const displayName = `${data.firstName} ${data.lastName}`.trim();

  await db
    .update(emailVerificationCodes)
    .set({ consumedAt: now })
    .where(eq(emailVerificationCodes.id, codeRow.id));

  await db.insert(users).values({
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
    createdAt: now,
  });
  await db.insert(userSettings).values({
    userId,
    weeklyCardioGoalMinutes: 150,
  });

  await db.insert(siteActivityLog).values({
    userId,
    action: "Rejestracja konta",
    metaJson: JSON.stringify({ role: data.role }),
    deploymentEnv: getAnalyticsDeployment(),
  });

  return { ok: true };
}
