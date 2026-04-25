"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { kcalFromMacros } from "@/lib/kcal-from-macros";

const goalsSchema = z.object({
  calories: z.number().min(0),
  proteinG: z.number().min(0),
  fatG: z.number().min(0),
  carbsG: z.number().min(0),
});

export type NutritionPlanFormState =
  | { ok: true }
  | { ok: false; error: string };

const payloadSchema = z.object({
  training: goalsSchema.nullable(),
  rest: goalsSchema.nullable(),
  dayTypes: z
    .record(z.string(), z.enum(["training", "rest"]))
    .optional()
    .superRefine((rec, ctx) => {
      if (!rec) return;
      for (const k of Object.keys(rec)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) {
          ctx.addIssue({
            code: "custom",
            message: "Nieprawidłowy klucz daty",
            path: ["dayTypes", k],
          });
        }
      }
    }),
});

export async function saveNutritionPlanAction(
  _prev: NutritionPlanFormState,
  formData: FormData,
): Promise<NutritionPlanFormState> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "Brak sesji." };

    const rawJson = formData.get("payload");
    if (typeof rawJson !== "string" || !rawJson.trim()) {
      return { ok: false, error: "Brak danych formularza." };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawJson);
    } catch {
      return { ok: false, error: "Nieprawidłowy JSON." };
    }

    const parsed = payloadSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return { ok: false, error: "Sprawdź wprowadzone wartości (cele i daty)." };
    }

    const normalizeGoals = (g: z.infer<typeof goalsSchema>) => ({
      ...g,
      calories: kcalFromMacros(g.proteinG, g.fatG, g.carbsG),
    });

    const trainingNorm = parsed.data.training
      ? normalizeGoals(parsed.data.training)
      : null;
    const restNorm = parsed.data.rest ? normalizeGoals(parsed.data.rest) : null;
    const training =
      trainingNorm && trainingNorm.calories > 0 ? trainingNorm : null;
    const rest = restNorm && restNorm.calories > 0 ? restNorm : null;

    const { dayTypes } = parsed.data;
    if (dayTypes && Object.keys(dayTypes).length > 800) {
      return { ok: false, error: "Zbyt wiele oznaczonych dni — skróć zakres." };
    }

    const db = getDb();
    await db
      .update(userSettings)
      .set({
        trainingNutritionGoalsJson: training ? JSON.stringify(training) : null,
        restNutritionGoalsJson: rest ? JSON.stringify(rest) : null,
        nutritionDayTypesJson:
          dayTypes && Object.keys(dayTypes).length > 0
            ? JSON.stringify(dayTypes)
            : null,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, session.user.id));

    revalidatePath("/profile");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    console.error("[saveNutritionPlanAction] failed", err);
    return {
      ok: false,
      error:
        "Nie udało się zapisać ustawień (błąd serwera). Odśwież stronę i spróbuj ponownie.",
    };
  }
}
