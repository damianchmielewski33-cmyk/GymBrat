import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { getWorkoutPlans } from "@/actions/workout-plan";
import { PlanEditorClient } from "@/components/plany/plan-editor-client";
import { getExercisesAsCatalog } from "@/lib/exercises/exercises-repository";
import { CATALOG_EXERCISES } from "@/lib/workout-exercise-catalog";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PlanEditPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const plans = await getWorkoutPlans();
  const item = plans.find((p) => p.id === id);
  if (!item) notFound();

  let catalog = CATALOG_EXERCISES;
  try {
    const fromDb = await getExercisesAsCatalog();
    if (fromDb.length > 0) catalog = fromDb;
  } catch {
    // fallback
  }

  return (
    <PlanEditorClient
      planId={item.id}
      initialPlan={item.plan}
      catalog={catalog}
    />
  );
}
