"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";

const schema = z.object({
  disabled: z.boolean(),
});

export async function updateAiFeaturesDisabledAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Brak sesji." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nieprawidłowe dane." };

  const disabled = parsed.data.disabled ? 1 : 0;
  const userId = session.user.id;
  const db = getDb();

  const [existing] = await db
    .select({ userId: userSettings.userId })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  if (!existing) {
    await db.insert(userSettings).values({
      userId,
      weeklyCardioGoalMinutes: 150,
      aiFeaturesDisabled: disabled,
    });
  } else {
    await db
      .update(userSettings)
      .set({
        aiFeaturesDisabled: disabled,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId));
  }

  revalidatePath("/profile");
  revalidatePath("/");
  revalidatePath("/progress-analysis");
  revalidatePath("/active-workout");
  revalidatePath("/start-workout");
  return { ok: true };
}
