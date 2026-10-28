"use server";

import { guardAction } from "@/lib/action-guard";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";

export async function logCardioFormAction(
  _prevState: unknown,
  formData: FormData,
) {
  await guardAction("workout.logCardioFormAction");
  const title = String(formData.get("title") ?? "Cardio").trim() || "Cardio";
  const minutes = Number(formData.get("minutes") ?? 0);
  return logTrainingSession({ title, cardioMinutes: minutes });
}

/**
 * Formularz arkusza „Dodaj cardio” — surowe FormData idzie do walidacji
 * (ADR 0009: zero cichego czyszczenia przed validateCardioMetrics).
 */
export async function logCardioDetailedAction(
  _prevState: unknown,
  formData: FormData,
) {
  await guardAction("workout.logCardioDetailedAction");
  const title = String(formData.get("title") ?? "Cardio").trim() || "Cardio";
  const typeRaw = String(formData.get("cardioType") ?? "").trim();
  const { createCardioLog } = await import("@/actions/cardio");
  const { isCardioTypeSlug, resolveCardioType } = await import(
    "@/lib/cardio-utils"
  );
  return createCardioLog({
    title,
    cardioMinutes: formData.get("minutes"),
    notes: formData.get("notes"),
    cardioType: isCardioTypeSlug(typeRaw)
      ? typeRaw
      : resolveCardioType(title),
    distanceKm: formData.get("distanceKm"),
    avgHr: formData.get("avgHr"),
    maxHr: formData.get("maxHr"),
    calories: formData.get("calories"),
    steps: formData.get("steps"),
    effortScore: formData.get("effortScore"),
    date: formData.get("date"),
  });
}

export async function logTrainingSession(input: {
  title: string;
  cardioMinutes: number;
  notes?: string;
  distanceKm?: number | null;
  avgHr?: number | null;
}) {
  await guardAction("workout.logTrainingSession");
  const { createCardioLog } = await import("@/actions/cardio");
  return createCardioLog(input);
}

export async function updateWeeklyCardioGoalForm(
  _prevState: unknown,
  formData: FormData,
) {
  await guardAction("workout.updateWeeklyCardioGoalForm");
  const raw = Number(formData.get("weeklyGoal") ?? 150);
  return updateWeeklyCardioGoal(raw);
}

export async function updateWeeklyCardioGoal(minutes: number) {
  await guardAction("workout.updateWeeklyCardioGoal");
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false as const,
      error: "Sesja wygasła. Zaloguj się ponownie, aby zmienić cel cardio.",
    };
  }

  const db = getDb();
  const m = Math.max(1, Math.round(minutes));

  await db
    .update(userSettings)
    .set({ weeklyCardioGoalMinutes: m, updatedAt: new Date() })
    .where(eq(userSettings.userId, session.user.id));

  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true as const };
}
