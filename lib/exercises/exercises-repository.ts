import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { exerciseTechniqueLinks, exercises } from "@/db/schema";
import {
  CATALOG_EXERCISES,
  type CatalogExercise,
} from "@/lib/workout-exercise-catalog";

export const EXERCISES_CACHE_TAG = "exercises";

export type ExerciseRow = {
  id: string;
  name: string;
  categoryId: string;
  secondaryCategoryIds: string[] | null;
  aliasesEn: string[] | null;
  aliasesPl: string[] | null;
  equipment: string[] | null;
  difficulty: string | null;
  description: string | null;
  cues: string[] | null;
  techniqueYoutubeUrl: string | null;
  techniqueYoutubeTitle: string | null;
  isActive: boolean;
};

function toCatalogShape(row: ExerciseRow): CatalogExercise {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    aliasesEn: row.aliasesEn ?? undefined,
    aliasesPl: row.aliasesPl ?? undefined,
    equipment: row.equipment ?? undefined,
    difficulty: row.difficulty ?? undefined,
    description: row.description ?? undefined,
    cues: row.cues ?? undefined,
    techniqueYoutubeUrl: row.techniqueYoutubeUrl ?? undefined,
  };
}

async function seedExercisesIfEmpty(): Promise<void> {
  await ensureCriticalSchema();
  const db = getDb();
  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(exercises);
  if ((countRow?.n ?? 0) > 0) return;

  const techniqueRows = await db.select().from(exerciseTechniqueLinks);
  const techniqueById = new Map(
    techniqueRows.map((r) => [r.id, r.youtubeUrl] as const),
  );
  const now = new Date();

  for (const ex of CATALOG_EXERCISES) {
    await db.insert(exercises).values({
      id: ex.id,
      name: ex.name,
      categoryId: ex.categoryId,
      aliasesEn: ex.aliasesEn ?? null,
      techniqueYoutubeUrl: techniqueById.get(ex.id) ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function loadActiveExercisesUncached(): Promise<ExerciseRow[]> {
  await seedExercisesIfEmpty();
  const db = getDb();
  const rows = await db
    .select()
    .from(exercises)
    .where(eq(exercises.isActive, true))
    .orderBy(asc(exercises.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    categoryId: r.categoryId,
    secondaryCategoryIds: r.secondaryCategoryIds ?? null,
    aliasesEn: r.aliasesEn ?? null,
    aliasesPl: r.aliasesPl ?? null,
    equipment: r.equipment ?? null,
    difficulty: r.difficulty ?? null,
    description: r.description ?? null,
    cues: r.cues ?? null,
    techniqueYoutubeUrl: r.techniqueYoutubeUrl ?? null,
    techniqueYoutubeTitle: r.techniqueYoutubeTitle ?? null,
    isActive: r.isActive,
  }));
}

export const getCachedActiveExercises = unstable_cache(
  loadActiveExercisesUncached,
  ["exercises-active-v1"],
  { tags: [EXERCISES_CACHE_TAG], revalidate: 3600 },
);

export async function getExerciseById(id: string): Promise<ExerciseRow | null> {
  const all = await getCachedActiveExercises();
  return all.find((e) => e.id === id) ?? null;
}

export async function getExercisesByCategory(
  categoryId: string,
): Promise<ExerciseRow[]> {
  const all = await getCachedActiveExercises();
  return all.filter((e) => e.categoryId === categoryId);
}

export async function getExercisesAsCatalog(): Promise<CatalogExercise[]> {
  const all = await getCachedActiveExercises();
  return all.map(toCatalogShape);
}

export async function countExercisesByCategory(): Promise<Record<string, number>> {
  const all = await getCachedActiveExercises();
  const out: Record<string, number> = {};
  for (const e of all) {
    out[e.categoryId] = (out[e.categoryId] ?? 0) + 1;
  }
  return out;
}

export async function getExerciseTechniqueUrlMapFromDb(): Promise<
  Record<string, string>
> {
  const all = await getCachedActiveExercises();
  const out: Record<string, string> = {};
  for (const e of all) {
    if (e.techniqueYoutubeUrl) out[e.id] = e.techniqueYoutubeUrl;
  }
  return out;
}

export async function updateExerciseTechniqueUrl(
  id: string,
  youtubeUrl: string | null,
  actorUserId: string,
): Promise<void> {
  await seedExercisesIfEmpty();
  const db = getDb();
  await db
    .update(exercises)
    .set({
      techniqueYoutubeUrl: youtubeUrl,
      updatedAt: new Date(),
      updatedByUserId: actorUserId,
    })
    .where(and(eq(exercises.id, id)));
}
