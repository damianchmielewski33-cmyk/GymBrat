"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import {
  fitnessGoalsSchema,
  fitnessGoalsToJson,
  parseFitnessGoalsJson,
} from "@/lib/fitness-goals";

export async function saveFitnessGoalsAction(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Brak sesji." };

  const parsed = fitnessGoalsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Nieprawidłowe cele." };

  const db = getDb();
  const [row] = await db
    .select({ fitnessGoalsJson: userSettings.fitnessGoalsJson })
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id))
    .limit(1);

  const prev = parseFitnessGoalsJson(row?.fitnessGoalsJson ?? null);
  const next = { ...prev, ...parsed.data };
  // Częściowy zapis z formularza profilu może czyścić cele ćwiczeń —
  // gdy input nie zawiera exerciseTargets, zostaw poprzednie.
  if (!("exerciseTargets" in (input as object))) {
    next.exerciseTargets = prev.exerciseTargets;
  }
  if (!("weeklySessionsTarget" in (input as object))) {
    next.weeklySessionsTarget = prev.weeklySessionsTarget;
  }
  if (!("targetWeightKg" in (input as object))) {
    next.targetWeightKg = prev.targetWeightKg;
  }

  const json = fitnessGoalsToJson(next);
  await db
    .update(userSettings)
    .set({
      fitnessGoalsJson: json,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, session.user.id));

  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/progress");
  revalidatePath("/progress-analysis");
  return { ok: true as const };
}
