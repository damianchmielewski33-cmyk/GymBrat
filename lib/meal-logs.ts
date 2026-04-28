import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureMealLogsTableOncePerProcess } from "@/db/ensure-schema";
import { mealLogs } from "@/db/schema";
import type { FitatuDaySummary } from "@/types/fitatu";

/** Wpis posiłku na potrzeby UI (lista / edycja). */
export type MealLogDto = {
  id: string;
  date: string;
  name: string | null;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  createdAtMs: number;
};

export type MealDayAggregate = {
  entryCount: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

/** Spożycie na dashboardzie: wyłącznie z ręcznych wpisów (bez wpisów — zera, cele z profilu/Fitatu zostają). */
export function replaceConsumptionWithMealLogs(
  summary: FitatuDaySummary,
  agg: MealDayAggregate | undefined,
): FitatuDaySummary {
  const has = agg != null && agg.entryCount > 0;
  const protein = has ? agg.protein : 0;
  const fat = has ? agg.fat : 0;
  const carbs = has ? agg.carbs : 0;
  const kcal = has ? agg.calories : 0;
  return {
    ...summary,
    caloriesConsumed: kcal,
    macros: { protein, fat, carbs },
  };
}

export async function getMealLogAggregatesForDates(
  userId: string,
  dates: string[],
): Promise<Record<string, MealDayAggregate>> {
  if (dates.length === 0) return {};
  await ensureMealLogsTableOncePerProcess();
  const db = getDb();
  const rows = await db
    .select({
      date: mealLogs.date,
      calories: mealLogs.calories,
      proteinG: mealLogs.proteinG,
      fatG: mealLogs.fatG,
      carbsG: mealLogs.carbsG,
    })
    .from(mealLogs)
    .where(and(eq(mealLogs.userId, userId), inArray(mealLogs.date, dates)));

  const map: Record<string, MealDayAggregate> = {};
  for (const d of dates) {
    map[d] = {
      entryCount: 0,
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
    };
  }

  for (const r of rows) {
    const agg = map[r.date];
    if (!agg) continue;
    agg.entryCount += 1;
    agg.protein += Number(r.proteinG);
    agg.fat += Number(r.fatG);
    agg.carbs += Number(r.carbsG);
    agg.calories += Number(r.calories);
  }

  return map;
}

export async function listMealLogsForDay(
  userId: string,
  date: string,
): Promise<MealLogDto[]> {
  await ensureMealLogsTableOncePerProcess();
  const db = getDb();
  const rows = await db
    .select()
    .from(mealLogs)
    .where(and(eq(mealLogs.userId, userId), eq(mealLogs.date, date)))
    .orderBy(asc(mealLogs.createdAt));

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    name: r.name,
    calories: Number(r.calories),
    proteinG: Number(r.proteinG),
    fatG: Number(r.fatG),
    carbsG: Number(r.carbsG),
    createdAtMs:
      r.createdAt instanceof Date ? r.createdAt.getTime() : Number(r.createdAt),
  }));
}

export async function listMealLogsForDates(
  userId: string,
  dates: string[],
): Promise<Record<string, MealLogDto[]>> {
  const unique = [...new Set(dates)].filter(Boolean);
  if (unique.length === 0) return {};

  await ensureMealLogsTableOncePerProcess();
  const db = getDb();
  const rows = await db
    .select()
    .from(mealLogs)
    .where(and(eq(mealLogs.userId, userId), inArray(mealLogs.date, unique)))
    .orderBy(asc(mealLogs.date), asc(mealLogs.createdAt));

  const out: Record<string, MealLogDto[]> = {};
  for (const d of unique) out[d] = [];

  for (const r of rows) {
    const dto: MealLogDto = {
      id: r.id,
      date: r.date,
      name: r.name,
      calories: Number(r.calories),
      proteinG: Number(r.proteinG),
      fatG: Number(r.fatG),
      carbsG: Number(r.carbsG),
      createdAtMs:
        r.createdAt instanceof Date ? r.createdAt.getTime() : Number(r.createdAt),
    };
    (out[r.date] ?? (out[r.date] = [])).push(dto);
  }

  return out;
}
