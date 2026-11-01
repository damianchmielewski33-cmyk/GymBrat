import {
  CATALOG_EXERCISES,
  findBestCatalogMatch,
  type CatalogExercise,
} from "@/lib/workout-exercise-catalog";

export type ExerciseAlternative = {
  id: string;
  name: string;
  categoryId: string;
};

function equipmentKey(e: CatalogExercise): string {
  return (e.equipment ?? []).slice().sort().join("|");
}

/**
 * Zamienniki ćwiczenia z tej samej kategorii mięśniowej: bez ćwiczeń już
 * w planie, najpierw inny sprzęt (nowy bodziec), potem ten sam. Maks. `limit`.
 */
export function suggestAlternatives(args: {
  name: string;
  categoryId?: string | null;
  planNames: string[];
  catalog?: CatalogExercise[];
  limit?: number;
}): ExerciseAlternative[] {
  const catalog = args.catalog ?? CATALOG_EXERCISES;
  const current = findBestCatalogMatch(args.name);
  const categoryId = args.categoryId ?? current?.categoryId ?? null;
  if (!categoryId) return [];
  const inPlan = new Set(args.planNames.map((n) => n.trim().toLowerCase()));
  inPlan.add(args.name.trim().toLowerCase());
  const currentEquip = current ? equipmentKey(current) : "";
  const pool = catalog.filter(
    (c) =>
      c.categoryId === categoryId &&
      c.id !== current?.id &&
      !inPlan.has(c.name.trim().toLowerCase()),
  );
  pool.sort((a, b) => {
    const da = equipmentKey(a) === currentEquip ? 1 : 0;
    const db = equipmentKey(b) === currentEquip ? 1 : 0;
    return da - db || a.name.localeCompare(b.name, "pl");
  });
  return pool.slice(0, args.limit ?? 3).map((c) => ({
    id: c.id,
    name: c.name,
    categoryId: c.categoryId,
  }));
}
