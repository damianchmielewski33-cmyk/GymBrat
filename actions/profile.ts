"use server";

import { guardAction } from "@/lib/action-guard";
import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings, users, weightLogs } from "@/db/schema";
import { getCurrentWeightKg } from "@/lib/current-weight";
import { fitnessGoalsToJson, parseFitnessGoalsJson } from "@/lib/fitness-goals";
import { WEIGHT_KG_MAX, WEIGHT_KG_MIN } from "@/lib/kcal-from-macros";
import { activityLevels } from "@/lib/validations/register";
import { UserMessages } from "@/lib/user-facing-errors";

function optionalCoercedNumber(min: number, max: number, int = false) {
  return z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    const n = Number(String(v).replace(",", "."));
    if (!Number.isFinite(n)) return v;
    return int ? Math.round(n) : n;
  }, z.number().min(min).max(max).optional());
}

const bodyParamsSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  weightKg: optionalCoercedNumber(WEIGHT_KG_MIN, WEIGHT_KG_MAX),
  heightCm: optionalCoercedNumber(100, 250, true),
  age: optionalCoercedNumber(13, 120, true),
  sex: z.enum(["male", "female", ""]).optional(),
  /** Puste = nie nadpisuj (U-3). */
  activityLevel: z.union([z.enum(activityLevels), z.literal("")]).optional(),
  weeklySessionsTarget: optionalCoercedNumber(1, 7, true),
});

export async function updateBodyParamsFormAction(
  _prevState: unknown,
  formData: FormData,
) {
  await guardAction("profile.updateBodyParamsFormAction");
  const input = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    weightKg: formData.get("weightKg"),
    heightCm: formData.get("heightCm"),
    age: formData.get("age"),
    sex: formData.get("sex") || "",
    activityLevel: formData.get("activityLevel") ?? "",
    weeklySessionsTarget: formData.get("weeklySessionsTarget") || undefined,
  };
  return updateBodyParams(input);
}

export async function updateBodyParamsFormActionVoid(
  formData: FormData,
): Promise<void> {
  await guardAction("profile.updateBodyParamsFormActionVoid");
  await updateBodyParamsFormAction(null, formData);
}

export async function updateBodyParams(input: unknown) {
  await guardAction("profile.updateBodyParams");
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: UserMessages.sessionExpired };
  }

  const parsed = bodyParamsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error:
        "Dane formularza są niepełne lub poza dozwolonym zakresem. Sprawdź pola i spróbuj ponownie.",
    };
  }

  const db = getDb();
  const data = parsed.data;
  const displayName = `${data.firstName} ${data.lastName}`.trim();
  const userId = session.user.id;

  const patch: {
    firstName: string;
    lastName: string;
    name: string;
    sex: string | null;
    weightKg?: number;
    heightCm?: number;
    age?: number;
    activityLevel?: string;
  } = {
    firstName: data.firstName,
    lastName: data.lastName,
    name: displayName,
    sex: data.sex === "male" || data.sex === "female" ? data.sex : null,
  };

  if (data.weightKg != null) {
    patch.weightKg = Math.round(data.weightKg * 10) / 10;
  }
  if (data.heightCm != null) {
    patch.heightCm = data.heightCm;
  }
  if (data.age != null) {
    patch.age = data.age;
  }
  if (data.activityLevel) {
    patch.activityLevel = data.activityLevel;
  }

  if (data.weightKg != null) {
    const current = await getCurrentWeightKg(userId);
    const nextKg = Math.round(data.weightKg * 10) / 10;
    if (current == null || Math.abs(current.weightKg - nextKg) >= 0.05) {
      await db.insert(weightLogs).values({
        userId,
        weightKg: nextKg,
        notes: null,
        recordedAt: new Date(),
      });
    }
  }

  await db.update(users).set(patch).where(eq(users.id, userId));

  if (data.weeklySessionsTarget != null) {
    const [row] = await db
      .select({ fitnessGoalsJson: userSettings.fitnessGoalsJson })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);
    const prev = parseFitnessGoalsJson(row?.fitnessGoalsJson ?? null);
    const json = fitnessGoalsToJson({
      ...prev,
      weeklySessionsTarget: data.weeklySessionsTarget,
    });
    const settingsPatch = {
      ...(json != null ? { fitnessGoalsJson: json } : {}),
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    };
    if (row) {
      await db
        .update(userSettings)
        .set(settingsPatch)
        .where(eq(userSettings.userId, userId));
    } else {
      await db.insert(userSettings).values({
        userId,
        weeklyCardioGoalMinutes: 150,
        ...settingsPatch,
      });
    }
  }

  revalidatePath("/profile");
  revalidatePath("/profile/body");
  revalidatePath("/complete-profile");
  revalidatePath("/");
  return { ok: true as const, savedAt: new Date().toISOString() };
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export async function changePasswordFormAction(
  _prevState: unknown,
  formData: FormData,
) {
  await guardAction("profile.changePasswordFormAction", {
    limit: 8,
    windowMs: 900000,
  });
  const input = {
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  };
  return changePassword(input);
}

export async function changePasswordFormActionVoid(
  formData: FormData,
): Promise<void> {
  await guardAction("profile.changePasswordFormActionVoid", {
    limit: 8,
    windowMs: 900000,
  });
  await changePasswordFormAction(null, formData);
}

export async function changePassword(input: unknown) {
  await guardAction("profile.changePassword", {
    limit: 8,
    windowMs: 900000,
  });
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: UserMessages.sessionExpired };
  }

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error:
        "Hasło musi mieć co najmniej 8 znaków, a obecne hasło nie może być puste.",
    };
  }

  const db = getDb();
  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!row?.passwordHash) {
    return { ok: false as const, error: "Account has no password" };
  }

  const ok = await compare(parsed.data.currentPassword, row.passwordHash);
  if (!ok) return { ok: false as const, error: "Current password is incorrect" };

  const nextHash = await hash(parsed.data.newPassword, 12);
  await db
    .update(users)
    .set({ passwordHash: nextHash })
    .where(eq(users.id, session.user.id));

  revalidatePath("/profile");
  revalidatePath("/profile/account");
  return { ok: true as const, savedAt: new Date().toISOString() };
}
