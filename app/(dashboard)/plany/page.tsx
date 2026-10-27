import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getWorkoutPlans } from "@/actions/workout-plan";
import { PlanListClient } from "@/components/plany/plan-list-client";
import { getCachedActiveExercises } from "@/lib/exercises/exercises-repository";
import { summarizePlanDayMuscles } from "@/lib/plan-day-muscles";
import { planSetCount } from "@/lib/workout-plan/plan-draft";
import { CATALOG_EXERCISES } from "@/lib/workout-exercise-catalog";

export default async function PlanyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const plans = await getWorkoutPlans();
  let exerciseCount = CATALOG_EXERCISES.length;
  try {
    const rows = await getCachedActiveExercises();
    if (rows.length > 0) exerciseCount = rows.length;
  } catch {
    // seed/DB niedostępne — fallback katalogu
  }

  const views = plans.map((item) => ({
    ...item,
    muscles: summarizePlanDayMuscles(item.plan.exercises),
    setsTotal: item.plan.exercises.reduce((n, ex) => n + planSetCount(ex), 0),
  }));

  return (
    <PlanListClient initialPlans={views} exerciseCount={exerciseCount} />
  );
}
