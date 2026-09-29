import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { exerciseTechniqueLinks } from "@/db/schema";
import { CATALOG_EXERCISES } from "@/lib/workout-exercise-catalog";
import { normalizeYoutubeUrl } from "@/lib/youtube-url";

let techniqueTableEnsured = false;

async function ensureTechniqueTable(): Promise<void> {
  if (techniqueTableEnsured) return;
  await ensureCriticalSchema();
  techniqueTableEnsured = true;
}

export type ExerciseTechniqueLinkRow = {
  catalogId: string;
  name: string;
  categoryId: string;
  youtubeUrl: string | null;
};

/** Mapa catalogId → URL (tylko ustawione). */
export async function loadExerciseTechniqueUrlMap(): Promise<Record<string, string>> {
  await ensureTechniqueTable();
  const db = getDb();
  const rows = await db.select().from(exerciseTechniqueLinks);
  const out: Record<string, string> = {};
  for (const row of rows) {
    const url = normalizeYoutubeUrl(row.youtubeUrl);
    if (url) out[row.id] = url;
  }
  return out;
}

/** Lista katalogu + aktualne URL-e do panelu admina. */
export async function listExerciseTechniqueAdminRows(): Promise<ExerciseTechniqueLinkRow[]> {
  const map = await loadExerciseTechniqueUrlMap();
  return CATALOG_EXERCISES.map((ex) => ({
    catalogId: ex.id,
    name: ex.name,
    categoryId: ex.categoryId,
    youtubeUrl: map[ex.id] ?? null,
  }));
}

export async function upsertExerciseTechniqueLink(
  catalogId: string,
  youtubeUrlRaw: string,
  actorUserId: string,
): Promise<{ catalogId: string; youtubeUrl: string | null }> {
  await ensureTechniqueTable();
  const id = catalogId.trim();
  if (!CATALOG_EXERCISES.some((e) => e.id === id)) {
    throw new Error("Nieznane ćwiczenie katalogu.");
  }
  const db = getDb();
  const url = normalizeYoutubeUrl(youtubeUrlRaw);
  const now = new Date();

  if (!url) {
    await db.delete(exerciseTechniqueLinks).where(eq(exerciseTechniqueLinks.id, id));
    return { catalogId: id, youtubeUrl: null };
  }

  const [prev] = await db
    .select({ id: exerciseTechniqueLinks.id })
    .from(exerciseTechniqueLinks)
    .where(eq(exerciseTechniqueLinks.id, id))
    .limit(1);

  if (prev) {
    await db
      .update(exerciseTechniqueLinks)
      .set({
        youtubeUrl: url,
        updatedAt: now,
        updatedByUserId: actorUserId,
      })
      .where(eq(exerciseTechniqueLinks.id, id));
  } else {
    await db.insert(exerciseTechniqueLinks).values({
      id,
      youtubeUrl: url,
      updatedAt: now,
      updatedByUserId: actorUserId,
    });
  }
  return { catalogId: id, youtubeUrl: url };
}
