import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getWorkoutPlansWithLastWorkout } from "@/actions/workout-plan";
import { TreningiHubClient } from "@/components/treningi/treningi-hub-client";
import { getTreningiHubStats } from "@/lib/treningi-hub-stats";

export default async function WorkoutPlanPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const [plans, stats] = await Promise.all([
    getWorkoutPlansWithLastWorkout(),
    getTreningiHubStats(userId),
  ]);

  return (
    <div className="px-1 pt-1 sm:px-0">
      <TreningiHubClient plans={plans} stats={stats} />
    </div>
  );
}
