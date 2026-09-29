"use server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import {
  parseProgressDeltaUnit,
  type ProgressDeltaUnit,
} from "@/lib/progress-delta-unit";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateProgressDeltaUnitAction(raw: unknown): Promise<{
  ok: boolean;
  error?: string;
  unit?: ProgressDeltaUnit;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sesja wygasła. Zaloguj się ponownie." };
  }

  const unit = parseProgressDeltaUnit(raw);
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
      .set({ progressDeltaUnit: unit, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId));
  } else {
    await db.insert(userSettings).values({
      userId,
      weeklyCardioGoalMinutes: 150,
      progressDeltaUnit: unit,
    });
  }

  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/workout-history");
  revalidatePath("/workout-plan");
  revalidatePath("/reports");
  revalidatePath("/progress-analysis");
  return { ok: true, unit };
}
