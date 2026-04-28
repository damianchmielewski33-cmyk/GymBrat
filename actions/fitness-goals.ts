"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { fitnessGoalsSchema, fitnessGoalsToJson } from "@/lib/fitness-goals";

export async function saveFitnessGoalsAction(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Brak sesji." };

  const parsed = fitnessGoalsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Nieprawidłowe cele." };

  const json = fitnessGoalsToJson(parsed.data);
  const db = getDb();
  await db
    .update(userSettings)
    .set({
      fitnessGoalsJson: json,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, session.user.id));

  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/progress-analysis");
  return { ok: true as const };
}
