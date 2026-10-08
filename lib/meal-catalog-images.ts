import "server-only";

import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { mealCatalog, mealCatalogImages } from "@/db/schema";
import type { CatalogMeal } from "@/lib/meal-catalog-types";
import {
  createFetchTimeoutSignal,
  fetchPollinationsImage,
  getPollinationsApiKey,
  POLLINATIONS_FOOD_MODEL,
} from "@/lib/pollinations-image";
import {
  buildAiRecipeImageFullPrompt,
  isDurableRecipeImageUrl,
  recipeImageSeed,
  RECIPE_IMAGE_CACHE_GENERATION,
} from "@/lib/recipe-image";

const GENERATE_TIMEOUT_MS = 22_000;
const DEFAULT_BATCH = 8;
const DEFAULT_CONCURRENCY = 2;

export function catalogMealImagePublicUrl(
  mealId: string,
  updatedAt: number | Date,
): string {
  const v =
    updatedAt instanceof Date ? updatedAt.getTime() : Math.round(updatedAt);
  return `/api/catalog-meal-image/${encodeURIComponent(mealId)}?v=${v}`;
}

export function isCatalogMealImagePath(url: string): boolean {
  if (url.startsWith("/api/catalog-meal-image/")) return true;
  try {
    const u = new URL(url, "https://gymbrat.local");
    return u.pathname.startsWith("/api/catalog-meal-image/");
  } catch {
    return false;
  }
}

async function ensureTables(): Promise<void> {
  await ensureCriticalSchema();
}

export async function getCatalogMealImage(
  mealId: string,
): Promise<{ mimeType: string; dataUrl: string; updatedAt: Date } | null> {
  await ensureTables();
  const db = getDb();
  const [row] = await db
    .select()
    .from(mealCatalogImages)
    .where(eq(mealCatalogImages.mealId, mealId))
    .limit(1);
  if (!row) return null;
  return {
    mimeType: row.mimeType,
    dataUrl: row.dataUrl,
    updatedAt: row.updatedAt,
  };
}

export async function upsertCatalogMealImage(args: {
  mealId: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<{ updatedAt: Date; publicUrl: string }> {
  await ensureTables();
  const db = getDb();
  const mime = args.mimeType.startsWith("image/")
    ? args.mimeType.split(";")[0]!.trim()
    : "image/jpeg";
  const b64 = Buffer.from(args.bytes).toString("base64");
  const dataUrl = `data:${mime};base64,${b64}`;
  const updatedAt = new Date();

  const [prev] = await db
    .select({ mealId: mealCatalogImages.mealId })
    .from(mealCatalogImages)
    .where(eq(mealCatalogImages.mealId, args.mealId))
    .limit(1);

  if (prev) {
    await db
      .update(mealCatalogImages)
      .set({ mimeType: mime, dataUrl, updatedAt })
      .where(eq(mealCatalogImages.mealId, args.mealId));
  } else {
    await db.insert(mealCatalogImages).values({
      mealId: args.mealId,
      mimeType: mime,
      dataUrl,
      updatedAt,
    });
  }

  return {
    updatedAt,
    publicUrl: catalogMealImagePublicUrl(args.mealId, updatedAt),
  };
}

export async function deleteCatalogMealImages(mealIds: string[]): Promise<void> {
  if (mealIds.length === 0) return;
  await ensureTables();
  const db = getDb();
  await db
    .delete(mealCatalogImages)
    .where(inArray(mealCatalogImages.mealId, mealIds));
}

export async function clearAllCatalogMealImages(): Promise<number> {
  await ensureTables();
  const db = getDb();
  const rows = await db.select({ id: mealCatalogImages.mealId }).from(mealCatalogImages);
  await db.delete(mealCatalogImages);
  return rows.length;
}

function mealNeedsAiImage(meal: CatalogMeal): boolean {
  const url = (meal.imageUrl ?? "").trim();
  if (!url) return true;
  if (isCatalogMealImagePath(url)) return false;
  if (isDurableRecipeImageUrl(url)) return false;
  return true;
}

async function patchMealImageUrl(
  mealId: string,
  imageUrl: string,
  actorUserId?: string,
): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(mealCatalog)
    .where(eq(mealCatalog.id, mealId))
    .limit(1);
  if (!row) return;
  let payload: CatalogMeal;
  try {
    payload = JSON.parse(row.payloadJson) as CatalogMeal;
  } catch {
    return;
  }
  const next = { ...payload, id: mealId, imageUrl };
  const now = new Date();
  await db
    .update(mealCatalog)
    .set({
      payloadJson: JSON.stringify(next),
      updatedAt: now,
      ...(actorUserId ? { updatedByUserId: actorUserId } : {}),
    })
    .where(eq(mealCatalog.id, mealId));
}

async function generateOneCatalogImage(
  meal: CatalogMeal,
  actorUserId?: string,
): Promise<"ok" | "skip" | "fail"> {
  if (!mealNeedsAiImage(meal)) return "skip";

  const existing = await getCatalogMealImage(meal.id);
  if (existing) {
    const url = catalogMealImagePublicUrl(meal.id, existing.updatedAt);
    if (meal.imageUrl !== url) {
      await patchMealImageUrl(meal.id, url, actorUserId);
    }
    return "skip";
  }

  const key = getPollinationsApiKey();
  if (!key) return "fail";

  const prompt = buildAiRecipeImageFullPrompt(meal);
  const seed = recipeImageSeed(
    `${meal.id}|${prompt}|g${RECIPE_IMAGE_CACHE_GENERATION}`,
  );
  const timed = createFetchTimeoutSignal(GENERATE_TIMEOUT_MS);
  try {
    const result = await fetchPollinationsImage({
      apiKey: key,
      prompt,
      seed,
      width: 640,
      height: 400,
      model: POLLINATIONS_FOOD_MODEL,
      signal: timed.signal,
    });
    if (!result.ok) return "fail";
    const saved = await upsertCatalogMealImage({
      mealId: meal.id,
      mimeType: result.contentType,
      bytes: result.bytes,
    });
    await patchMealImageUrl(meal.id, saved.publicUrl, actorUserId);
    return "ok";
  } catch {
    return "fail";
  } finally {
    timed.clear();
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

export type GenerateCatalogImagesResult = {
  generated: number;
  skipped: number;
  failed: number;
  pending: number;
  /** true = wciąż są przepisy bez trwałej grafiki */
  hasMore: boolean;
};

/**
 * Generuje brakujące grafiki AI (raz) i zapisuje w DB.
 * Wywoływane przy imporcie JSON oraz w pętli admina przy większych paczkach.
 */
export async function generateMissingCatalogImages(args?: {
  mealIds?: string[];
  limit?: number;
  concurrency?: number;
  actorUserId?: string;
}): Promise<GenerateCatalogImagesResult> {
  await ensureTables();
  const db = getDb();
  const limit = Math.max(1, Math.min(40, args?.limit ?? DEFAULT_BATCH));
  const concurrency = Math.max(1, Math.min(4, args?.concurrency ?? DEFAULT_CONCURRENCY));

  let candidates: CatalogMeal[] = [];
  if (args?.mealIds?.length) {
    const rows = await db
      .select()
      .from(mealCatalog)
      .where(inArray(mealCatalog.id, args.mealIds));
    for (const row of rows) {
      try {
        const m = JSON.parse(row.payloadJson) as CatalogMeal;
        candidates.push({ ...m, id: row.id });
      } catch {
        /* skip */
      }
    }
  } else {
    const rows = await db.select().from(mealCatalog);
    for (const row of rows) {
      try {
        const m = JSON.parse(row.payloadJson) as CatalogMeal;
        candidates.push({ ...m, id: row.id });
      } catch {
        /* skip */
      }
    }
  }

  const needing = candidates.filter(mealNeedsAiImage);
  const batch = needing.slice(0, limit);
  const results = await mapPool(batch, concurrency, (meal) =>
    generateOneCatalogImage(meal, args?.actorUserId),
  );

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  for (const r of results) {
    if (r === "ok") generated++;
    else if (r === "skip") skipped++;
    else failed++;
  }

  const notAttempted = Math.max(0, needing.length - batch.length);
  const pending = notAttempted + failed;
  return {
    generated,
    skipped,
    failed,
    pending,
    hasMore: pending > 0,
  };
}
