"use server";

import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { listMealLogsForDay, type MealLogDto } from "@/lib/meal-logs";
import {
  loadNutritionSummaryForDate,
  resolveNutritionDayKind,
} from "@/lib/nutrition-dashboard";
import { computeMacroGaps, type MacroGaps } from "@/lib/meal-suggestions-gaps";
import {
  nutritionSettingsFromDbRow,
  type NutritionDayType,
} from "@/lib/nutrition-goals";
import type { FitatuDaySummary } from "@/types/fitatu";

export type DietDayPayload = {
  dateKey: string;
  summary: FitatuDaySummary;
  gaps: MacroGaps;
  logs: MealLogDto[];
  dayKind: NutritionDayType;
};

async function settingsRowFor(userId: string) {
  const db = getDb();
  const [settingsRow] = await db
    .select({
      trainingNutritionGoalsJson: userSettings.trainingNutritionGoalsJson,
      restNutritionGoalsJson: userSettings.restNutritionGoalsJson,
      nutritionDayTypesJson: userSettings.nutritionDayTypesJson,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return settingsRow;
}

export async function loadDietDayAction(
  dateKey: string,
): Promise<{ ok: true; data: DietDayPayload } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Musisz być zalogowany." };

  const parsed = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(dateKey);
  if (!parsed.success) return { ok: false, error: "Nieprawidłowa data." };

  const userId = session.user.id;
  const settingsRow = await settingsRowFor(userId);
  const summary = await loadNutritionSummaryForDate(userId, parsed.data, settingsRow);
  const logs = await listMealLogsForDay(userId, parsed.data);
  const gaps = computeMacroGaps({ ...summary, date: parsed.data });
  const dayKind = resolveNutritionDayKind(settingsRow, parsed.data);

  return {
    ok: true,
    data: {
      dateKey: parsed.data,
      summary: { ...summary, date: parsed.data },
      gaps: { ...gaps, dateKey: parsed.data },
      logs,
      dayKind,
    },
  };
}

/** Przełącznik Treningowy / Nietreningowy na Diecie (jak w Getao). */
export async function setDietDayKindAction(
  dateKey: string,
  kind: NutritionDayType,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Musisz być zalogowany." };

  const parsedDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(dateKey);
  if (!parsedDate.success) return { ok: false, error: "Nieprawidłowa data." };
  if (kind !== "training" && kind !== "rest") {
    return { ok: false, error: "Nieprawidłowy typ dnia." };
  }

  const userId = session.user.id;
  const settingsRow = await settingsRowFor(userId);
  const current = nutritionSettingsFromDbRow(
    settingsRow ?? {
      trainingNutritionGoalsJson: null,
      restNutritionGoalsJson: null,
      nutritionDayTypesJson: null,
    },
  );
  const dayTypes = { ...current.dayTypes, [parsedDate.data]: kind };
  const json = JSON.stringify(dayTypes);
  const db = getDb();

  if (settingsRow) {
    await db
      .update(userSettings)
      .set({ nutritionDayTypesJson: json })
      .where(eq(userSettings.userId, userId));
  } else {
    await db.insert(userSettings).values({
      userId,
      nutritionDayTypesJson: json,
    });
  }

  revalidatePath("/meal-suggestions");
  revalidatePath("/");
  return { ok: true };
}
