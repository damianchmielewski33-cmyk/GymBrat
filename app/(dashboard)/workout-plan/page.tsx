import { getWorkoutPlan } from "@/actions/workout-plan";
import { WorkoutPlanEditor } from "@/components/workout-plan/workout-plan-editor";

export default function WorkoutPlanPage() {
  const planPromise = getWorkoutPlan();
  return (
    <WorkoutPlanPageInner planPromise={planPromise} />
  );
}

async function WorkoutPlanPageInner({
  planPromise,
}: {
  planPromise: ReturnType<typeof getWorkoutPlan>;
}) {
  const initialPlan = await planPromise;
  return <WorkoutPlanEditor initialPlan={initialPlan} />;
}
