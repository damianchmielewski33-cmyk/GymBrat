"use server";

import { guardAction } from "@/lib/action-guard";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";

export async function completeIntroTourAction() {
  await guardAction("intro-tour.completeIntroTourAction");
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Brak sesji." };

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
      .set({
        introTourCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId));
  } else {
    await db.insert(userSettings).values({
      userId,
      introTourCompletedAt: new Date(),
    });
  }

  revalidatePath("/");
  return { ok: true as const };
}
