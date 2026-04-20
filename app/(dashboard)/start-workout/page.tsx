import { getWorkoutPlansWithLastWorkout } from "@/actions/workout-plan";
import { ActiveWorkoutView } from "@/components/active-workout/active-workout-view";

export default async function StartWorkoutPage() {
  const initialPlans = await getWorkoutPlansWithLastWorkout();
  return <ActiveWorkoutView entry="start" initialPlans={initialPlans} />;
}

