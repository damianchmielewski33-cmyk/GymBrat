import { auth } from "@/auth";
import { getWorkoutPlansWithLastWorkout } from "@/actions/workout-plan";
import { ActiveWorkoutView } from "@/components/active-workout/active-workout-view";
import { getUserAiFeaturesDisabled } from "@/lib/user-ai-preference";

export default async function StartWorkoutPage() {
  const session = await auth();
  const uid = session?.user?.id;
  const [initialPlans, userAiFeaturesDisabled] = await Promise.all([
    getWorkoutPlansWithLastWorkout(),
    uid ? getUserAiFeaturesDisabled(uid) : Promise.resolve(false),
  ]);
  return (
    <ActiveWorkoutView
      entry="start"
      initialPlans={initialPlans}
      userAiFeaturesDisabled={userAiFeaturesDisabled}
    />
  );
}

