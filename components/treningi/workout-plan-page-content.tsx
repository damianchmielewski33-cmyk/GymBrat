import { getWorkoutPlansWithLastWorkout } from "@/actions/workout-plan";
import { TreningiHubClient } from "@/components/treningi/treningi-hub-client";
import { listUserTeamsForGroupStart } from "@/lib/community/group-workout";
import { getTreningiHubStats } from "@/lib/treningi-hub-stats";

export async function WorkoutPlanPageContent({ userId }: { userId: string }) {
  const [plans, stats, teams] = await Promise.all([
    getWorkoutPlansWithLastWorkout(),
    getTreningiHubStats(userId),
    listUserTeamsForGroupStart(userId),
  ]);

  return <TreningiHubClient plans={plans} stats={stats} teams={teams} />;
}
