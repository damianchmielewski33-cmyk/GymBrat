import { getWorkoutPlans } from "@/actions/workout-plan";
import { WorkoutPlanEditor } from "@/components/workout-plan/workout-plan-editor";

export default function ProfileWorkoutPlanPage() {
  const plansPromise = getWorkoutPlans();
  return <Inner plansPromise={plansPromise} />;
}

async function Inner({
  plansPromise,
}: {
  plansPromise: ReturnType<typeof getWorkoutPlans>;
}) {
  const initialPlans = await plansPromise;
  return <WorkoutPlanEditor initialPlans={initialPlans} />;
}
