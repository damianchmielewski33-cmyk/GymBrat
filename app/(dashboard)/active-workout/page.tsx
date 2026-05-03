import { auth } from "@/auth";
import { getWorkoutPlansWithLastWorkout } from "@/actions/workout-plan";
import { ActiveWorkoutView } from "@/components/active-workout/active-workout-view";
import { getUserAiFeaturesDisabled } from "@/lib/user-ai-preference";

/** App Router: `/active-workout` (equivalent to a classic `pages/active-workout` route). */
export default async function ActiveWorkoutPage() {
  const session = await auth();
  const uid = session?.user?.id;
  const [initialPlans, userAiFeaturesDisabled] = await Promise.all([
    getWorkoutPlansWithLastWorkout(),
    uid ? getUserAiFeaturesDisabled(uid) : Promise.resolve(false),
  ]);
  return (
    <ActiveWorkoutView
      entry="active"
      initialPlans={initialPlans}
      userAiFeaturesDisabled={userAiFeaturesDisabled}
    />
  );
}
