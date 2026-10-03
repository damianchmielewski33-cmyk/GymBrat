import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getWorkoutHistoryOverview } from "@/lib/workout-history-overview";
import { WorkoutHistoryView } from "@/components/workout-history/workout-history-view";

export default async function WorkoutHistoryPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const overview = await getWorkoutHistoryOverview(userId);

  return <WorkoutHistoryView overview={overview} />;
}
