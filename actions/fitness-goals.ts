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
  if (!("supplements" in (input as object))) {
    next.supplements = prev.supplements;
  }

  const json = fitnessGoalsToJson(next);
  if (row) {
    await db
      .update(userSettings)
      .set({
        fitnessGoalsJson: json,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, session.user.id));
  } else {
    await db.insert(userSettings).values({
      userId: session.user.id,
      fitnessGoalsJson: json,
    });
  }

  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/supplements");
  revalidatePath("/meal-suggestions");
  revalidatePath("/progress");
  revalidatePath("/progress-analysis");
  return { ok: true as const };
}

/** Zapis listy suplementów (nazwa + dawka) w fitnessGoalsJson. */
export async function saveSupplementsAction(
  supplements: Array<{ name: string; amount?: string }>,
) {
  const cleaned = supplements
    .map((s) => ({
      name: s.name.trim(),
      ...(s.amount?.trim() ? { amount: s.amount.trim() } : {}),
    }))
    .filter((s) => s.name.length > 0)
    .slice(0, 40);

  return saveFitnessGoalsAction({ supplements: cleaned });
}
