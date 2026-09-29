import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { mealCatalog } from "@/db/schema";
import { MEAL_CATALOG_GENERATED } from "@/lib/meal-catalog-data";
import { mergeMealCatalogs, type CatalogMeal } from "@/lib/meal-catalog";
import { parseCatalogImportPayload, type CatalogImportMode } from "@/lib/meal-catalog-import";

let catalogTableEnsured = false;

async function ensureMealCatalogTable(): Promise<void> {
  if (catalogTableEnsured) return;
  await ensureCriticalSchema();
  catalogTableEnsured = true;
}

function parsePayload(json: string): CatalogMeal | null {
  try {
    const raw = JSON.parse(json) as unknown;
    if (!raw || typeof raw !== "object") return null;
    const m = raw as CatalogMeal;
    if (!m.id || !m.title || !m.slot || !m.approximateMacros) return null;
    return m;
  } catch {
    return null;
  }
}

export async function listDbCatalogMeals(): Promise<CatalogMeal[]> {
  await ensureMealCatalogTable();
  const db = getDb();
  const rows = await db.select().from(mealCatalog);
  const out: CatalogMeal[] = [];
  for (const row of rows) {
    const meal = parsePayload(row.payloadJson);
    if (meal) out.push({ ...meal, id: row.id });
  }
  return out;
}

/** Statyczny seed + wpisy z bazy (DB nadpisuje to samo id). */
export async function loadMergedMealCatalog(): Promise<CatalogMeal[]> {
  const dbMeals = await listDbCatalogMeals();
  return mergeMealCatalogs(MEAL_CATALOG_GENERATED, dbMeals);
}

export async function importCatalogMealsFromJson(
  input: unknown,
  actorUserId: string,
): Promise<{ upserted: number; removed: number; mode: CatalogImportMode; totalMerged: number }> {
  await ensureMealCatalogTable();
  const { meals, mode } = parseCatalogImportPayload(input);
  const db = getDb();
  let removed = 0;

  if (mode === "replace") {
    const existing = await db.select({ id: mealCatalog.id }).from(mealCatalog);
    removed = existing.length;
    await db.delete(mealCatalog);
  }

  const now = new Date();
  for (const meal of meals) {
    const payloadJson = JSON.stringify(meal);
    const [prev] = await db
      .select({ id: mealCatalog.id })
      .from(mealCatalog)
      .where(eq(mealCatalog.id, meal.id))
      .limit(1);
    if (prev) {
      await db
        .update(mealCatalog)
        .set({
          payloadJson,
          updatedAt: now,
          updatedByUserId: actorUserId,
        })
        .where(eq(mealCatalog.id, meal.id));
    } else {
      await db.insert(mealCatalog).values({
        id: meal.id,
        payloadJson,
        updatedAt: now,
        updatedByUserId: actorUserId,
      });
    }
  }

  const totalMerged = (await loadMergedMealCatalog()).length;
  return { upserted: meals.length, removed, mode, totalMerged };
}

export async function clearDbCatalogMeals(): Promise<number> {
  await ensureMealCatalogTable();
  const db = getDb();
  const existing = await db.select({ id: mealCatalog.id }).from(mealCatalog);
  await db.delete(mealCatalog);
  return existing.length;
}
