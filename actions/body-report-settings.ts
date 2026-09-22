"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { clampBodyReportIntervalDays } from "@/lib/body-report-schedule";

export async function saveBodyReportIntervalAction(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false as const,
      error: "Sesja wygasła. Zaloguj się ponownie.",
    };
  }

  const raw =
    input && typeof input === "object" && "intervalDays" in input
      ? (input as { intervalDays: unknown }).intervalDays
      : input;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return { ok: false as const, error: "Podaj liczbę dni." };
  }
  const intervalDays = clampBodyReportIntervalDays(n);

  const db = getDb();
  const userId = session.user.id;
  const [existing] = await db
    .select({ userId: userSettings.userId })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(userSettings)
      .set({ bodyReportIntervalDays: intervalDays, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId));
  } else {
    await db.insert(userSettings).values({
      userId,
      weeklyCardioGoalMinutes: 150,
      bodyReportIntervalDays: intervalDays,
    });
  }

  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true as const, intervalDays };
}
