"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth, signIn } from "@/auth";
import {
  analyzeBodyPhoto,
  generateTrainingPlan,
  type TrainingPlanInput,
} from "@/ai/coach";
import type { AiImage } from "@/ai/client";
import { updateBodyParams } from "@/actions/profile";
import { getDb } from "@/db";
import { users, userSettings, workouts } from "@/db/schema";
import { getReportsData } from "@/lib/reports";
import { getWeeklyCardioProgress as getWeeklyCardioProgressData } from "@/lib/cardio";
import { calendarDateKey } from "@/lib/local-date";
import { activityLevels } from "@/lib/validations/register";
import { getTodaysMacrosCached } from "@/services/fitatu";

export async function loginUser(
  email: string,
  password: string,
  options?: { callbackUrl?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = email.trim().toLowerCase();
  if (!e || !password) {
    return { ok: false, error: "Email and password are required." };
  }
  const result = await signIn("credentials", {
    email: e,
    password,
    redirect: false,
    callbackUrl: options?.callbackUrl ?? "/",
  });
  if (result?.error) {
    return { ok: false, error: "Invalid email or password." };
  }
  return { ok: true };
}

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  activityLevel: string | null;
  weeklyCardioGoalMinutes: number;
};

export async function getUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const db = getDb();
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      weightKg: users.weightKg,
      heightCm: users.heightCm,
      age: users.age,
      activityLevel: users.activityLevel,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!row) return null;

  const [settings] = await db
    .select({ weeklyCardioGoalMinutes: userSettings.weeklyCardioGoalMinutes })
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id))
    .limit(1);

  return {
    ...row,
    weeklyCardioGoalMinutes: settings?.weeklyCardioGoalMinutes ?? 150,
  };
}

export async function getReports() {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "Unauthorized" };
  }
  const data = await getReportsData(session.user.id);
  return { ok: true as const, data };
}

const saveWorkoutSessionSchema = z.object({
  cardioMinutes: z.coerce.number().min(0),
  exercises: z.unknown().optional().default([]),
});

function resolveWorkoutDateKey(raw: unknown): string {
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return calendarDateKey(raw);
  return calendarDateKey(new Date());
}

export async function saveWorkoutSession(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Unauthorized" };

  const parsed = saveWorkoutSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid workout payload" };
  }

  const rawIn = input as Record<string, unknown>;
  const dateKey = resolveWorkoutDateKey(rawIn.date);

  const { cardioMinutes, exercises } = parsed.data;
  const exercisesJson = JSON.stringify(exercises ?? []);
  const db = getDb();
  await db.insert(workouts).values({
    userId: session.user.id,
    date: dateKey,
    cardioMinutes: Math.max(0, Math.round(cardioMinutes)),
    exercises: exercisesJson,
  });

  revalidatePath("/");
  revalidatePath("/reports");
  return { ok: true as const };
}

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  weightKg: z.coerce.number().min(30).max(400).optional(),
  heightCm: z.coerce.number().int().min(100).max(250).optional(),
  age: z.coerce.number().int().min(13).max(120).optional(),
  activityLevel: z.enum(activityLevels).optional(),
  weeklyCardioGoalMinutes: z.coerce.number().int().min(1).max(2000).optional(),
});

export async function updateProfile(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Unauthorized" };

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid profile data" };
  }

  const data = parsed.data;
  const hasBody =
    data.firstName != null &&
    data.lastName != null &&
    data.weightKg != null &&
    data.heightCm != null &&
    data.age != null &&
    data.activityLevel != null;

  if (hasBody) {
    const r = await updateBodyParams({
      firstName: data.firstName,
      lastName: data.lastName,
      weightKg: data.weightKg,
      heightCm: data.heightCm,
      age: data.age,
      activityLevel: data.activityLevel,
    });
    if (!r.ok) return r;
  }

  if (data.weeklyCardioGoalMinutes != null) {
    const db = getDb();
    await db
      .update(userSettings)
      .set({
        weeklyCardioGoalMinutes: data.weeklyCardioGoalMinutes,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, session.user.id));
    revalidatePath("/");
    revalidatePath("/profile");
  }

  return { ok: true as const };
}

export async function getFitatuData() {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "Unauthorized" };
  }
  const data = await getTodaysMacrosCached(session.user.id);
  return { ok: true as const, data };
}

export async function getWeeklyCardioProgress() {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "Unauthorized" };
  }
  const progress = await getWeeklyCardioProgressData(session.user.id);
  return {
    ok: true as const,
    weeklyGoal: progress.weeklyGoal,
    minutesCompleted: progress.minutesCompleted,
    percentProgress: progress.percent,
  };
}

const aiPlanSchema = z.object({
  goals: z.array(z.string()).optional(),
  daysPerWeek: z.coerce.number().int().min(1).max(7).optional(),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  equipment: z.array(z.string()).optional(),
  injuriesOrLimitations: z.string().optional(),
});

export async function aiGeneratePlan(overrides?: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "Unauthorized" };
  }

  const user = await getUser();
  if (!user) return { ok: false as const, error: "User not found" };

  const parsed = aiPlanSchema.safeParse(overrides ?? {});
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid plan options" };
  }

  const o = parsed.data;
  if (
    user.weightKg == null ||
    user.heightCm == null ||
    user.age == null ||
    !user.activityLevel
  ) {
    return {
      ok: false as const,
      error: "Complete body metrics and activity level in your profile first.",
    };
  }

  const fitatu = await getTodaysMacrosCached(session.user.id);
  const activityMap: Record<
    string,
    TrainingPlanInput["activityLevel"]
  > = {
    low: "sedentary",
    medium: "moderate",
    high: "active",
  };
  const activityLevel =
    activityMap[user.activityLevel] ?? "moderate";

  const input: TrainingPlanInput = {
    age: user.age,
    weightKg: user.weightKg,
    heightCm: user.heightCm,
    activityLevel,
    goals: o.goals?.length ? o.goals : ["General fitness"],
    daysPerWeek: o.daysPerWeek ?? 4,
    experienceLevel: o.experienceLevel,
    equipment: o.equipment,
    injuriesOrLimitations: o.injuriesOrLimitations
      ? [o.injuriesOrLimitations]
      : undefined,
    fitatuNutrition: fitatu,
  };

  const plan = await generateTrainingPlan(input);
  return { ok: true as const, plan };
}

const aiPhotoSchema = z.object({
  images: z.array(
    z.object({
      mimeType: z.string().min(1),
      base64: z.string().min(1),
    }),
  ),
});

export async function aiAnalyzePhoto(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "Unauthorized" };
  }

  const parsed = aiPhotoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid image payload" };
  }

  const images: AiImage[] = parsed.data.images.map((im) => ({
    mimeType: im.mimeType,
    base64: im.base64,
  }));

  const analysis = await analyzeBodyPhoto({ images });
  return { ok: true as const, analysis };
}

export { registerUser, type RegisterState } from "@/actions/auth";
