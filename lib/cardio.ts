import "server-only";

import { getCardioWeekSummary } from "@/lib/cardio-week";

export * from "@/lib/cardio-utils";

/**
 * Postęp celu cardio — cienki wrapper na `getCardioWeekSummary`
 * (jedna definicja tygodnia: `lib/cardio-week-range.ts`, US12).
 */
export async function getWeeklyCardioProgress(userId: string) {
  const s = await getCardioWeekSummary(userId);
  return {
    weeklyGoal: s.goalMinutes,
    minutesCompleted: s.minutes,
    percent: s.percent,
  };
}
