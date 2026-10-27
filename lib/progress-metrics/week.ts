import { getProgressHubData } from "@/lib/progress-hub";
import type { ProgressTabData } from "@/lib/progress-metrics/types";

export async function loadProgressWeekMetrics(userId: string): Promise<ProgressTabData["tydzien"]> {
  const { week, intelligence } = await getProgressHubData(userId, "tydzien");
  return { week, intelligence };
}
