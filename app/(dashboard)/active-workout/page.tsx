import { getWorkoutPlansWithLastWorkout } from "@/actions/workout-plan";
import { DesktopTrainingGuard } from "@/components/active-workout/desktop-training-guard";
import { ActiveWorkoutView } from "@/components/active-workout/active-workout-view";

/** App Router: `/active-workout` (equivalent to a classic `pages/active-workout` route). */
export const metadata = { title: "Aktywny trening" };

export default async function ActiveWorkoutPage() {
  const initialPlans = await getWorkoutPlansWithLastWorkout();
  return (
    <DesktopTrainingGuard>
      <ActiveWorkoutView entry="active" initialPlans={initialPlans} />
    </DesktopTrainingGuard>
  );
}
