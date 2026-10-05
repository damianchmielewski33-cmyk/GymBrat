import { getWorkoutPlansWithLastWorkout } from "@/actions/workout-plan";
import { TreningiHubClient } from "@/components/treningi/treningi-hub-client";
import { getTreningiHubStats } from "@/lib/treningi-hub-stats";

export async function WorkoutPlanPageContent({ userId }: { userId: string }) {
  const [plans, stats] = await Promise.all([
    getWorkoutPlansWithLastWorkout(),
    getTreningiHubStats(userId),
  ]);

  return <TreningiHubClient plans={plans} stats={stats} />;
}
