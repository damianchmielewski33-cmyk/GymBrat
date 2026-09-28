import { getWorkoutPlans } from "@/actions/workout-plan";
import { WorkoutPlanEditor } from "@/components/workout-plan/workout-plan-editor";

type PageProps = {
  searchParams?: Promise<{ edit?: string }>;
};

export default async function ProfileWorkoutPlanPage({ searchParams }: PageProps) {
  const [initialPlans, params] = await Promise.all([
    getWorkoutPlans(),
    searchParams ?? Promise.resolve({} as { edit?: string }),
  ]);
  const editId =
    typeof params.edit === "string" && params.edit.trim()
      ? params.edit.trim()
      : null;
  return (
    <WorkoutPlanEditor initialPlans={initialPlans} initialEditId={editId} />
  );
}
