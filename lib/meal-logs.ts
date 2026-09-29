import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureMealLogsTableOncePerProcess } from "@/db/ensure-schema";
import { mealLogs } from "@/db/schema";
import type { DietDiarySlot } from "@/lib/diet-diary-slots";
import { isDietDiarySlot } from "@/lib/diet-diary-slots";
import type { FitatuDaySummary } from "@/types/fitatu";
import type { FoodProduct } from "@/lib/food-products-types";
import { findLocalProductByBarcode, normalizeFoodQuery } from "@/lib/food-products";

/** Wpis posiłku na potrzeby UI (lista / edycja). */
export type MealLogDto = {
  id: string;
  date: string;
  name: string | null;
  slot: DietDiarySlot | null;
  barcode: string | null;
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
    slot: isDietDiarySlot(r.slot) ? r.slot : null,
    barcode: r.barcode ?? null,
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
      slot: isDietDiarySlot(r.slot) ? r.slot : null,
      barcode: r.barcode ?? null,
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

/**
 * Unikalne produkty z historii wpisów (ostatnie dni) — do „Ostatnio jedzone”.
 * Klucz: barcode albo znormalizowana nazwa (bez gramatury w nawiasie).
 */
export async function listRecentFoodProductsFromLogs(
  userId: string,
  limit = 24,
): Promise<FoodProduct[]> {
  await ensureMealLogsTableOncePerProcess();
  const db = getDb();
  const rows = await db
    .select({
      name: mealLogs.name,
      barcode: mealLogs.barcode,
      calories: mealLogs.calories,
      proteinG: mealLogs.proteinG,
      fatG: mealLogs.fatG,
      carbsG: mealLogs.carbsG,
      createdAt: mealLogs.createdAt,
    })
    .from(mealLogs)
    .where(eq(mealLogs.userId, userId))
    .orderBy(desc(mealLogs.createdAt))
    .limit(200);

  const seen = new Set<string>();
  const out: FoodProduct[] = [];

  for (const r of rows) {
    const rawName = (r.name ?? "").trim();
    if (!rawName) continue;
    // „Jogurt (150 g)” → baza do klucza / wyświetlania
    const baseName = rawName.replace(/\s*\([^)]*\)\s*$/, "").trim() || rawName;
    const code = (r.barcode ?? "").replace(/\D/g, "");
    const key = code
      ? `ean:${code}`
      : `name:${normalizeFoodQuery(baseName)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const fromCatalog = code ? findLocalProductByBarcode(code) : null;
    if (fromCatalog) {
      out.push(fromCatalog);
    } else {
      out.push({
        id: code
          ? `recent-ean-${code}`
          : `recent-name-${normalizeFoodQuery(baseName).slice(0, 48) || out.length}`,
        barcode: code || null,
        name: baseName,
        servingLabel: "ostatni wpis",
        calories: Number(r.calories),
        proteinG: Number(r.proteinG),
        fatG: Number(r.fatG),
        carbsG: Number(r.carbsG),
        source: "local",
        basisAmount: 1,
        basisUnit: "pcs",
      });
    }
    if (out.length >= limit) break;
  }

  return out;
}
