import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AtlasClient } from "@/components/plany/atlas-client";
import { DashboardRouteSkeleton } from "@/components/layout/dashboard-route-skeleton";
import {
  countExercisesByCategory,
  getExercisesAsCatalog,
} from "@/lib/exercises/exercises-repository";
import {
  CATALOG_EXERCISES,
  MUSCLE_CATEGORIES,
} from "@/lib/workout-exercise-catalog";

export default async function AtlasPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let catalog = CATALOG_EXERCISES;
  let counts: Record<string, number> = {};
  for (const c of MUSCLE_CATEGORIES) {
    counts[c.id] = CATALOG_EXERCISES.filter((e) => e.categoryId === c.id).length;
  }
  try {
    const fromDb = await getExercisesAsCatalog();
    if (fromDb.length > 0) {
      catalog = fromDb;
      counts = await countExercisesByCategory();
    }
  } catch {
    // fallback katalogu
  }

  return (
    <Suspense fallback={<DashboardRouteSkeleton />}>
      <AtlasClient catalog={catalog} counts={counts} />
    </Suspense>
  );
}
