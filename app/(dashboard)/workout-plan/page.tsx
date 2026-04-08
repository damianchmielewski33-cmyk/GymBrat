import { getWorkoutPlans } from "@/actions/workout-plan";
import { WorkoutPlanEditor } from "@/components/workout-plan/workout-plan-editor";

export default function WorkoutPlanPage() {
  const plansPromise = getWorkoutPlans();
  return <WorkoutPlanPageInner plansPromise={plansPromise} />;
}

async function WorkoutPlanPageInner({
  plansPromise,
}: {
  plansPromise: ReturnType<typeof getWorkoutPlans>;
}) {
  const initialPlans = await plansPromise;
  return <WorkoutPlanEditor initialPlans={initialPlans} />;
}
