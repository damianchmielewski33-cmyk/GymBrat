import { TreningiHubClient } from "@/components/treningi/treningi-hub-client";
import { listUserTeamsForGroupStart } from "@/lib/community/group-workout";
import { calendarDateKey } from "@/lib/local-date";
import { getTreningiHubData } from "@/lib/treningi-hub-data";
import { getTreningiHubStats } from "@/lib/treningi-hub-stats";

export async function WorkoutPlanPageContent({ userId }: { userId: string }) {
  // Jedno „dziś” dla tygodnia, segmentów, cardio, serii i etykiet względnych (ADR 0002, D3).
  const todayKey = calendarDateKey();
  const [hub, stats, teams] = await Promise.all([
    getTreningiHubData(userId, todayKey),
    getTreningiHubStats(userId, todayKey),
    listUserTeamsForGroupStart(userId),
  ]);

  return <TreningiHubClient hub={hub} stats={stats} teams={teams} />;
}
