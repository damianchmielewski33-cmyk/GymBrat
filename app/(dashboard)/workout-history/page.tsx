import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { getWorkoutHistoryOverview } from "@/lib/workout-history-overview";
import { parseProgressDeltaUnit } from "@/lib/progress-delta-unit";
import { WorkoutHistoryView } from "@/components/workout-history/workout-history-view";

export default async function WorkoutHistoryPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const db = getDb();
  const [settings] = await db
    .select({ progressDeltaUnit: userSettings.progressDeltaUnit })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const overview = await getWorkoutHistoryOverview(userId);

  return (
    <WorkoutHistoryView
      overview={overview}
      progressDeltaUnit={parseProgressDeltaUnit(settings?.progressDeltaUnit)}
    />
  );
}
