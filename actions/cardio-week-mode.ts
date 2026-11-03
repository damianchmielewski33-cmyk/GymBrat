"use server";

import { guardAction } from "@/lib/action-guard";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { parseCardioWeekMode, type CardioWeekMode } from "@/lib/cardio-week-range";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/** Zapisuje, jak liczyć tydzień cardio: pon–niedz (`calendar`) albo ostatnie 7 dni (`rolling`). */
export async function updateCardioWeekModeAction(raw: unknown): Promise<{
  ok: boolean;
  error?: string;
  mode?: CardioWeekMode;
}> {
  await guardAction("cardio-week-mode.updateCardioWeekModeAction");
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sesja wygasła. Zaloguj się ponownie." };
  }
  if (raw !== "calendar" && raw !== "rolling") {
    return { ok: false, error: "Nieprawidłowy tryb tygodnia." };
  }

  const mode = parseCardioWeekMode(raw);
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
      .set({ cardioWeekMode: mode, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId));
  } else {
    await db.insert(userSettings).values({
      userId,
      weeklyCardioGoalMinutes: 150,
      cardioWeekMode: mode,
    });
  }

  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/treningi");
  revalidatePath("/reports");
  return { ok: true, mode };
}
