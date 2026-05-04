import { auth } from "@/auth";
import { getWorkoutPlansWithLastWorkout } from "@/actions/workout-plan";
import { ActiveWorkoutView } from "@/components/active-workout/active-workout-view";
import { getUserAiEntitled, getUserAiFeaturesDisabled } from "@/lib/user-ai-preference";

/** App Router: `/active-workout` (equivalent to a classic `pages/active-workout` route). */
export default async function ActiveWorkoutPage() {
  const session = await auth();
  const uid = session?.user?.id;
  const [initialPlans, userAiFeaturesDisabled, userAiEntitled] = await Promise.all([
    getWorkoutPlansWithLastWorkout(),
    uid ? getUserAiFeaturesDisabled(uid) : Promise.resolve(false),
    uid ? getUserAiEntitled(uid) : Promise.resolve(true),
  ]);
  return (
    <ActiveWorkoutView
      entry="active"
      initialPlans={initialPlans}
      userAiFeaturesDisabled={userAiFeaturesDisabled}
      userAiEntitled={userAiEntitled}
    />
  );
}
