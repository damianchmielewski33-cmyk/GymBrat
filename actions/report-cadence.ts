"use server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { clampReportCadenceDays } from "@/lib/report-cadence";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateReportCadenceForm(
  _prev: { ok?: boolean; error?: string },
  formData: FormData,
) {
  return updateReportCadenceDays(formData.get("reportCadenceDays"));
}

export async function updateReportCadenceDays(raw: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false as const,
      error: "Sesja wygasła. Zaloguj się ponownie.",
    };
  }

  const days = clampReportCadenceDays(raw);
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
      .set({ reportCadenceDays: days, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId));
  } else {
    await db.insert(userSettings).values({
      userId,
      weeklyCardioGoalMinutes: 150,
      reportCadenceDays: days,
    });
  }

  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/reports");
  return { ok: true as const, days };
}
