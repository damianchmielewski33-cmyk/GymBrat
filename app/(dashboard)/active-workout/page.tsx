import { getWorkoutPlansWithLastWorkout } from "@/actions/workout-plan";
import { ActiveWorkoutView } from "@/components/active-workout/active-workout-view";

/** App Router: `/active-workout` (equivalent to a classic `pages/active-workout` route). */
export default async function ActiveWorkoutPage() {
  const initialPlans = await getWorkoutPlansWithLastWorkout();
  return <ActiveWorkoutView initialPlans={initialPlans} />;
}
