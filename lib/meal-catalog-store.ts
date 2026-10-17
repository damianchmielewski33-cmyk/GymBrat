import "server-only";

import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { mealCatalog, mealCatalogImages } from "@/db/schema";
import type { CatalogMeal } from "@/lib/meal-catalog";
import { parseCatalogImportPayload, type CatalogImportMode } from "@/lib/meal-catalog-import";
import {
  catalogMealImagePublicUrl,
  clearAllCatalogMealImages,
  deleteCatalogMealImages,
  generateMissingCatalogImages,
  type GenerateCatalogImagesResult,
} from "@/lib/meal-catalog-images";

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
    const macros = m.approximateMacros;
    if (
      typeof macros.calories !== "number" ||
      typeof macros.proteinG !== "number" ||
      typeof macros.fatG !== "number" ||
      typeof macros.carbsG !== "number"
    ) {
      return null;
    }
    const ingredients = Array.isArray(m.ingredients)
      ? m.ingredients.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [];
    const steps = Array.isArray(m.steps)
      ? m.steps.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [];
    const prepMinutes =
      typeof m.prepMinutes === "number" && Number.isFinite(m.prepMinutes)
        ? Math.max(1, Math.round(m.prepMinutes))
        : 20;
    return {
      ...m,
      ingredients: ingredients.length >= 1 ? ingredients : ["Składniki — uzupełnij w katalogu", "Porcja"],
      steps: steps.length >= 1 ? steps : ["Przygotuj składniki", "Zjedz"],
      prepMinutes,
      approximateMacros: {
        calories: Math.max(0, macros.calories),
        proteinG: Math.max(0, macros.proteinG),
        fatG: Math.max(0, macros.fatG),
        carbsG: Math.max(0, macros.carbsG),
      },
    };
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

  // Podłącz trwałe grafiki z meal_catalog_images, gdy payload nie ma imageUrl
  // (albo ma legacy/pusty) — inaczej dieta pokazuje tylko placeholder „GymBrat”.
  if (out.length === 0) return out;
  const ids = out.map((m) => m.id);
  const imageRows = await db
    .select({
      mealId: mealCatalogImages.mealId,
      updatedAt: mealCatalogImages.updatedAt,
    })
    .from(mealCatalogImages)
    .where(inArray(mealCatalogImages.mealId, ids));
  if (imageRows.length === 0) return out;

  const byId = new Map(
    imageRows.map((r) => [
      r.mealId,
      catalogMealImagePublicUrl(r.mealId, r.updatedAt),
    ]),
  );
  return out.map((meal) => {
    const fromDb = byId.get(meal.id);
    if (!fromDb) return meal;
    const current = (meal.imageUrl ?? "").trim();
    if (current.startsWith("/api/catalog-meal-image/")) {
      return { ...meal, imageUrl: fromDb };
    }
    if (!current) return { ...meal, imageUrl: fromDb };
    return meal;
  });
}

/** Przepisy widoczne w Dietcie — wyłącznie z bazy panelu admina. */
export async function loadMergedMealCatalog(): Promise<CatalogMeal[]> {
  return listDbCatalogMeals();
}

export async function importCatalogMealsFromJson(
  input: unknown,
  actorUserId: string,
): Promise<{
  upserted: number;
  removed: number;
  mode: CatalogImportMode;
  totalMerged: number;
  images: GenerateCatalogImagesResult;
}> {
  await ensureMealCatalogTable();
  const { meals, mode } = parseCatalogImportPayload(input);
  const db = getDb();
  let removed = 0;

  if (mode === "replace") {
    const existing = await db.select({ id: mealCatalog.id }).from(mealCatalog);
    removed = existing.length;
    await clearAllCatalogMealImages();
    await db.delete(mealCatalog);
  }

  const now = new Date();
  const importedIds = meals.map((m) => m.id);
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

  // Generacja AI raz przy imporcie (Pollinations) → meal_catalog_images + trwały imageUrl.
  // Dieta tylko odczytuje zapisany asset — bez ponownej generacji przy otwieraniu.
  let images = await generateMissingCatalogImages({
    mealIds: importedIds,
    limit: Math.min(12, Math.max(4, importedIds.length)),
    concurrency: 2,
    actorUserId,
  });

  // Kolejne paczki w tym samym requeście (małe katalogi kończą się od razu).
  let rounds = 0;
  while (images.hasMore && !images.missingApiKey && rounds < 8) {
    rounds += 1;
    const next = await generateMissingCatalogImages({
      mealIds: importedIds,
      limit: 8,
      concurrency: 2,
      actorUserId,
    });
    images = {
      generated: images.generated + next.generated,
      skipped: images.skipped + next.skipped,
      failed: next.failed,
      pending: next.pending,
      hasMore: next.hasMore,
      missingApiKey: next.missingApiKey,
      error: next.error ?? images.error,
    };
  }

  const totalMerged = (await loadMergedMealCatalog()).length;
  return { upserted: meals.length, removed, mode, totalMerged, images };
}

export async function clearDbCatalogMeals(): Promise<number> {
  await ensureMealCatalogTable();
  const db = getDb();
  const existing = await db.select({ id: mealCatalog.id }).from(mealCatalog);
  await clearAllCatalogMealImages();
  await db.delete(mealCatalog);
  return existing.length;
}

export async function removeCatalogMeal(mealId: string): Promise<boolean> {
  await ensureMealCatalogTable();
  const db = getDb();
  const [prev] = await db
    .select({ id: mealCatalog.id })
    .from(mealCatalog)
    .where(eq(mealCatalog.id, mealId))
    .limit(1);
  if (!prev) return false;
  await deleteCatalogMealImages([mealId]);
  await db.delete(mealCatalog).where(eq(mealCatalog.id, mealId));
  return true;
}
