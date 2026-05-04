import { auth } from "@/auth";
import { getWorkoutPlansWithLastWorkout } from "@/actions/workout-plan";
import { ActiveWorkoutView } from "@/components/active-workout/active-workout-view";
import { getUserAiEntitled, getUserAiFeaturesDisabled } from "@/lib/user-ai-preference";

export default async function StartWorkoutPage() {
  const session = await auth();
  const uid = session?.user?.id;
  const [initialPlans, userAiFeaturesDisabled, userAiEntitled] = await Promise.all([
    getWorkoutPlansWithLastWorkout(),
    uid ? getUserAiFeaturesDisabled(uid) : Promise.resolve(false),
    uid ? getUserAiEntitled(uid) : Promise.resolve(true),
  ]);
  return (
    <ActiveWorkoutView
      entry="start"
      initialPlans={initialPlans}
      userAiFeaturesDisabled={userAiFeaturesDisabled}
      userAiEntitled={userAiEntitled}
    />
  );
}

