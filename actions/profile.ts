"use server";

import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings, users } from "@/db/schema";
import { fitnessGoalsToJson, parseFitnessGoalsJson } from "@/lib/fitness-goals";
import { activityLevels } from "@/lib/validations/register";
import { UserMessages } from "@/lib/user-facing-errors";

const bodyParamsSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  weightKg: z.coerce.number().min(30).max(400),
  heightCm: z.coerce.number().int().min(100).max(250),
  age: z.coerce.number().int().min(13).max(120),
  activityLevel: z.enum(activityLevels),
  weeklySessionsTarget: z.coerce.number().int().min(1).max(7).optional(),
});

export async function updateBodyParamsFormAction(
  _prevState: unknown,
  formData: FormData,
) {
  const input = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    weightKg: formData.get("weightKg"),
    heightCm: formData.get("heightCm"),
    age: formData.get("age"),
    activityLevel: formData.get("activityLevel"),
    weeklySessionsTarget: formData.get("weeklySessionsTarget") || undefined,
  };
  return updateBodyParams(input);
}

export async function updateBodyParamsFormActionVoid(formData: FormData): Promise<void> {
  await updateBodyParamsFormAction(null, formData);
}

export async function updateBodyParams(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: UserMessages.sessionExpired };
  }

  const parsed = bodyParamsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Dane formularza są niepełne lub poza dozwolonym zakresem. Sprawdź pola i spróbuj ponownie.",
    };
  }

  const db = getDb();
  const data = parsed.data;
  const displayName = `${data.firstName} ${data.lastName}`.trim();

  await db
    .update(users)
    .set({
      firstName: data.firstName,
      lastName: data.lastName,
      name: displayName,
      weightKg: Math.round(data.weightKg * 10) / 10,
      heightCm: data.heightCm,
      age: data.age,
      activityLevel: data.activityLevel,
    })
    .where(eq(users.id, session.user.id));

  if (data.weeklySessionsTarget != null) {
    const [row] = await db
      .select({ fitnessGoalsJson: userSettings.fitnessGoalsJson })
      .from(userSettings)
      .where(eq(userSettings.userId, session.user.id))
      .limit(1);
    const prev = parseFitnessGoalsJson(row?.fitnessGoalsJson ?? null);
    const json = fitnessGoalsToJson({
      ...prev,
      weeklySessionsTarget: data.weeklySessionsTarget,
    });
    const patch = {
      ...(json != null ? { fitnessGoalsJson: json } : {}),
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    };
    if (row) {
      await db
        .update(userSettings)
        .set(patch)
        .where(eq(userSettings.userId, session.user.id));
    } else {
      await db.insert(userSettings).values({
        userId: session.user.id,
        weeklyCardioGoalMinutes: 150,
        ...patch,
      });
    }
  }

  revalidatePath("/profile");
  revalidatePath("/complete-profile");
  revalidatePath("/");
  return { ok: true as const };
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export async function changePasswordFormAction(
  _prevState: unknown,
  formData: FormData,
) {
  const input = {
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  };
  return changePassword(input);
}

export async function changePasswordFormActionVoid(formData: FormData): Promise<void> {
  await changePasswordFormAction(null, formData);
}

export async function changePassword(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: UserMessages.sessionExpired };
  }

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Hasło musi mieć co najmniej 8 znaków, a obecne hasło nie może być puste.",
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
  return { ok: true as const };
}

