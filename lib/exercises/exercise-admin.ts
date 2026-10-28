import "server-only";

import { and, asc, eq, like, or, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { exercises } from "@/db/schema";
import { EXERCISES_CACHE_TAG } from "@/lib/exercises/exercises-repository";
import { MUSCLE_CATEGORIES } from "@/lib/workout-exercise-catalog";
import { normalizeYoutubeUrl } from "@/lib/youtube-url";

const CATEGORY_IDS = new Set(MUSCLE_CATEGORIES.map((c) => c.id));

const stringList = z
  .array(z.string().trim().min(1).max(80))
  .max(20)
  .optional()
  .nullable();

export const exerciseCreateSchema = z.object({
  id: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9_-]*$/i, "Id: litery, cyfry, _ i -."),
  name: z.string().trim().min(2).max(120),
  categoryId: z.string().refine((id) => CATEGORY_IDS.has(id), "Nieznana partia."),
  secondaryCategoryIds: stringList,
  aliasesEn: stringList,
  aliasesPl: stringList,
  equipment: stringList,
  difficulty: z
    .enum(["beginner", "intermediate", "advanced"])
    .optional()
    .nullable(),
  description: z.string().trim().min(20).max(4000),
  cues: stringList,
  techniqueYoutubeUrl: z.string().trim().max(500).optional().nullable(),
  techniqueYoutubeTitle: z.string().trim().max(200).optional().nullable(),
});

export const exercisePatchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  categoryId: z
    .string()
    .refine((id) => CATEGORY_IDS.has(id), "Nieznana partia.")
    .optional(),
  secondaryCategoryIds: stringList,
  aliasesEn: stringList,
  aliasesPl: stringList,
  equipment: stringList,
  difficulty: z
    .enum(["beginner", "intermediate", "advanced"])
    .optional()
    .nullable(),
  description: z.string().trim().min(20).max(4000).optional().nullable(),
  cues: stringList,
  techniqueYoutubeUrl: z.string().trim().max(500).optional().nullable(),
  techniqueYoutubeTitle: z.string().trim().max(200).optional().nullable(),
  isActive: z.boolean().optional(),
});

export type AdminExerciseRow = {
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
  updatedAt: string;
};

function mapRow(r: typeof exercises.$inferSelect): AdminExerciseRow {
  return {
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
    updatedAt: r.updatedAt.toISOString(),
  };
}

function revalidateExercises() {
  revalidateTag(EXERCISES_CACHE_TAG, "max");
}

export async function listAdminExercises(args: {
  query?: string;
  categoryId?: string;
  onlyMissingDescription?: boolean;
  includeInactive?: boolean;
  limit: number;
  offset: number;
}): Promise<{ rows: AdminExerciseRow[]; total: number }> {
  await ensureCriticalSchema();
  const db = getDb();
  const conditions = [];
  if (!args.includeInactive) {
    conditions.push(eq(exercises.isActive, true));
  }
  if (args.categoryId && args.categoryId !== "all") {
    conditions.push(eq(exercises.categoryId, args.categoryId));
  }
  const q = args.query?.trim();
  if (q) {
    const likeQ = `%${q}%`;
    conditions.push(
      or(like(exercises.name, likeQ), like(exercises.id, likeQ))!,
    );
  }
  if (args.onlyMissingDescription) {
    conditions.push(
      or(eq(exercises.description, ""), sql`${exercises.description} is null`)!,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(exercises)
    .where(where);
  const rows = await db
    .select()
    .from(exercises)
    .where(where)
    .orderBy(asc(exercises.name))
    .limit(args.limit)
    .offset(args.offset);

  return {
    total: Number(countRow?.n ?? 0),
    rows: rows.map(mapRow),
  };
}

export async function createAdminExercise(
  input: z.infer<typeof exerciseCreateSchema>,
  actorUserId: string,
): Promise<AdminExerciseRow> {
  await ensureCriticalSchema();
  const parsed = exerciseCreateSchema.parse(input);
  const db = getDb();
  const [existing] = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(eq(exercises.id, parsed.id))
    .limit(1);
  if (existing) {
    throw new Error("Ćwiczenie o takim id już istnieje.");
  }
  const now = new Date();
  const youtubeUrl = parsed.techniqueYoutubeUrl
    ? normalizeYoutubeUrl(parsed.techniqueYoutubeUrl)
    : null;
  await db.insert(exercises).values({
    id: parsed.id,
    name: parsed.name,
    categoryId: parsed.categoryId,
    secondaryCategoryIds: parsed.secondaryCategoryIds ?? null,
    aliasesEn: parsed.aliasesEn ?? null,
    aliasesPl: parsed.aliasesPl ?? null,
    equipment: parsed.equipment ?? null,
    difficulty: parsed.difficulty ?? null,
    description: parsed.description,
    cues: parsed.cues ?? null,
    techniqueYoutubeUrl: youtubeUrl,
    techniqueYoutubeTitle: parsed.techniqueYoutubeTitle ?? null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId,
  });
  revalidateExercises();
  const [row] = await db
    .select()
    .from(exercises)
    .where(eq(exercises.id, parsed.id))
    .limit(1);
  return mapRow(row!);
}

export async function patchAdminExercise(
  id: string,
  input: z.infer<typeof exercisePatchSchema>,
  actorUserId: string,
): Promise<AdminExerciseRow> {
  await ensureCriticalSchema();
  const parsed = exercisePatchSchema.parse(input);
  const db = getDb();
  const [existing] = await db
    .select()
    .from(exercises)
    .where(eq(exercises.id, id))
    .limit(1);
  if (!existing) {
    throw new Error("Nie znaleziono ćwiczenia.");
  }

  const patch: Partial<typeof exercises.$inferInsert> = {
    updatedAt: new Date(),
    updatedByUserId: actorUserId,
  };
  if (parsed.name !== undefined) patch.name = parsed.name;
  if (parsed.categoryId !== undefined) patch.categoryId = parsed.categoryId;
  if (parsed.secondaryCategoryIds !== undefined) {
    patch.secondaryCategoryIds = parsed.secondaryCategoryIds;
  }
  if (parsed.aliasesEn !== undefined) patch.aliasesEn = parsed.aliasesEn;
  if (parsed.aliasesPl !== undefined) patch.aliasesPl = parsed.aliasesPl;
  if (parsed.equipment !== undefined) patch.equipment = parsed.equipment;
  if (parsed.difficulty !== undefined) patch.difficulty = parsed.difficulty;
  if (parsed.description !== undefined) patch.description = parsed.description;
  if (parsed.cues !== undefined) patch.cues = parsed.cues;
  if (parsed.techniqueYoutubeUrl !== undefined) {
    patch.techniqueYoutubeUrl = parsed.techniqueYoutubeUrl
      ? normalizeYoutubeUrl(parsed.techniqueYoutubeUrl)
      : null;
  }
  if (parsed.techniqueYoutubeTitle !== undefined) {
    patch.techniqueYoutubeTitle = parsed.techniqueYoutubeTitle;
  }
  if (parsed.isActive !== undefined) patch.isActive = parsed.isActive;

  await db.update(exercises).set(patch).where(eq(exercises.id, id));
  revalidateExercises();
  const [row] = await db
    .select()
    .from(exercises)
    .where(eq(exercises.id, id))
    .limit(1);
  return mapRow(row!);
}

export async function deactivateAdminExercise(
  id: string,
  actorUserId: string,
): Promise<AdminExerciseRow> {
  return patchAdminExercise(id, { isActive: false }, actorUserId);
}
