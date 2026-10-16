import {
  FALLBACK_MUSCLE_CATEGORY,
  inferMuscleCategoryFromName,
} from "@/lib/infer-muscle-category";
import {
  categoryLabel,
  findBestCatalogMatch,
  type MuscleCategory,
  MUSCLE_CATEGORIES,
} from "@/lib/workout-exercise-catalog";

export type MuscleRegionId = MuscleCategory["id"];

/** Synergiści — słabsze podświetlenie obok partii głównej. */
const SECONDARY_BY_PRIMARY: Partial<Record<MuscleRegionId, MuscleRegionId[]>> = {
  chest: ["shoulders", "triceps"],
  back_upper: ["biceps", "forearms"],
  back_mid: ["biceps", "forearms"],
  back_lower: ["glutes", "hamstrings", "core"],
  shoulders: ["triceps"],
  biceps: ["forearms"],
  triceps: ["shoulders"],
  quads: ["glutes", "core"],
  hamstrings: ["glutes", "core"],
  glutes: ["hamstrings", "core"],
  calves: [],
  core: [],
  forearms: [],
  cardio: [],
};

const VALID = new Set(MUSCLE_CATEGORIES.map((c) => c.id));

export function isMuscleRegionId(id: string | null | undefined): id is MuscleRegionId {
  return typeof id === "string" && VALID.has(id);
}

/**
 * Partia mięśniowa ćwiczenia.
 * Katalog po nazwie, potem heurystyka PL/EN, na końcu categoryId z planu.
 * (Stare importy miały domyślne „shoulders” — nie mogą wygrywać z nazwą.)
 */
export function resolveExerciseMuscleCategory(args: {
  name: string;
  categoryId?: string | null;
}): MuscleRegionId | null {
  const hit = findBestCatalogMatch(args.name);
  if (hit && isMuscleRegionId(hit.categoryId)) return hit.categoryId;
  const inferred = inferMuscleCategoryFromName(args.name);
  if (inferred) return inferred;
  if (isMuscleRegionId(args.categoryId)) return args.categoryId;
  return null;
}

/** categoryId do zapisu w planie / sesji — nigdy nie fallbackuj na „shoulders”. */
export function resolveExerciseCategoryIdForPlan(
  name: string,
  categoryId?: string | null,
): string {
  return (
    resolveExerciseMuscleCategory({ name, categoryId }) ??
    FALLBACK_MUSCLE_CATEGORY
  );
}

export type ResolvedExerciseMuscles = {
  primary: MuscleRegionId | null;
  secondary: MuscleRegionId[];
  label: string | null;
  /** true = plecy / uda tył — pokaż widok z tyłu jako główny. */
  preferBackView: boolean;
};

const BACK_PRIMARY = new Set<MuscleRegionId>([
  "back_upper",
  "back_mid",
  "back_lower",
  "glutes",
  "hamstrings",
  "calves",
  "triceps",
]);

export function resolveExerciseMuscles(args: {
  name: string;
  categoryId?: string | null;
}): ResolvedExerciseMuscles {
  const primary = resolveExerciseMuscleCategory(args);
  if (!primary || primary === "cardio") {
    return {
      primary: primary === "cardio" ? "cardio" : null,
      secondary: [],
      label: primary ? categoryLabel(primary) : null,
      preferBackView: false,
    };
  }
  const secondary = (SECONDARY_BY_PRIMARY[primary] ?? []).filter(
    (id) => id !== primary,
  );
  return {
    primary,
    secondary,
    label: categoryLabel(primary),
    preferBackView: BACK_PRIMARY.has(primary),
  };
}
