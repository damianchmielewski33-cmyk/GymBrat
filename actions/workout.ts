"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings, workouts } from "@/db/schema";
import { calendarDateKey } from "@/lib/local-date";

export async function logCardioFormAction(
  _prevState: unknown,
  formData: FormData,
) {
  const title = String(formData.get("title") ?? "Cardio").trim() || "Cardio";
  const minutes = Number(formData.get("minutes") ?? 0);
  const machineId = String(formData.get("machineId") ?? "other").trim() || "other";
  const distanceKmRaw = Number(formData.get("distanceKm") ?? 0);
  const distanceKm =
    Number.isFinite(distanceKmRaw) && distanceKmRaw > 0
      ? Math.round(distanceKmRaw * 100) / 100
      : null;
  let routePoints: unknown = null;
  try {
    const raw = String(formData.get("routeJson") ?? "[]");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) routePoints = parsed.slice(0, 2000);
  } catch {
    routePoints = null;
  }
  return logTrainingSession({
    title,
    cardioMinutes: minutes,
    machineId,
    distanceKm,
    routePoints,
  });
}

export async function logTrainingSession(input: {
  title: string;
  cardioMinutes: number;
  notes?: string;
  machineId?: string;
  distanceKm?: number | null;
  routePoints?: unknown;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false as const,
      error: "Sesja wygasła. Zaloguj się ponownie, aby zapisać wpis treningu.",
    };
  }

  const db = getDb();
  const dateKey = calendarDateKey(new Date());
  await db.insert(workouts).values({
    userId: session.user.id,
    date: dateKey,
    cardioMinutes: Math.max(0, Math.round(input.cardioMinutes)),
    exercises: JSON.stringify({
      kind: "cardio_log",
      title: input.title,
      notes: input.notes ?? null,
      machineId: input.machineId ?? null,
      distanceKm: input.distanceKm ?? null,
      routePoints: input.routePoints ?? null,
      loggedAt: Date.now(),
    }),
  });

  revalidatePath("/");
  revalidatePath("/cardio");
  revalidatePath("/reports");
  return { ok: true as const };
}

export async function updateWeeklyCardioGoalForm(
  _prevState: unknown,
  formData: FormData,
) {
  const raw = Number(formData.get("weeklyGoal") ?? 150);
  return updateWeeklyCardioGoal(raw);
}

export async function updateWeeklyCardioGoal(minutes: number) {
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
