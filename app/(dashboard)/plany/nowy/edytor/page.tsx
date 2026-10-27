import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PlanEditorClient } from "@/components/plany/plan-editor-client";
import { getExercisesAsCatalog } from "@/lib/exercises/exercises-repository";
import { createEmptyWorkoutPlan } from "@/lib/workout-plan/plan-draft";
import { CATALOG_EXERCISES } from "@/lib/workout-exercise-catalog";

export default async function NowyPlanEdytorPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let catalog = CATALOG_EXERCISES;
  try {
    const fromDb = await getExercisesAsCatalog();
    if (fromDb.length > 0) catalog = fromDb;
  } catch {
    // fallback
  }

  return (
    <PlanEditorClient
      planId={null}
      initialPlan={createEmptyWorkoutPlan()}
      catalog={catalog}
    />
  );
}
