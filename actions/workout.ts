"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";

export async function logCardioFormAction(
  _prevState: unknown,
  formData: FormData,
) {
  const title = String(formData.get("title") ?? "Cardio").trim() || "Cardio";
  const minutes = Number(formData.get("minutes") ?? 0);
  return logTrainingSession({ title, cardioMinutes: minutes });
}

export async function logCardioDetailedAction(
  _prevState: unknown,
  formData: FormData,
) {
  const title = String(formData.get("title") ?? "Cardio").trim() || "Cardio";
  const minutes = Number(formData.get("minutes") ?? 0);
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const distanceRaw = String(formData.get("distanceKm") ?? "")
    .trim()
    .replace(",", ".");
  const avgHrRaw = String(formData.get("avgHr") ?? "").trim();
  const distanceKm = distanceRaw ? Number(distanceRaw) : null;
  const avgHr = avgHrRaw ? Number(avgHrRaw) : null;
  const { createCardioLog } = await import("@/actions/cardio");
  return createCardioLog({
    title,
    cardioMinutes: minutes,
    notes: notesRaw || undefined,
    distanceKm:
      distanceKm != null && Number.isFinite(distanceKm) && distanceKm > 0
        ? distanceKm
        : null,
    avgHr:
      avgHr != null && Number.isFinite(avgHr) && avgHr > 0
        ? Math.round(avgHr)
        : null,
  });
}

export async function logTrainingSession(input: {
  title: string;
  cardioMinutes: number;
  notes?: string;
  distanceKm?: number | null;
  avgHr?: number | null;
}) {
  const { createCardioLog } = await import("@/actions/cardio");
  return createCardioLog(input);
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
