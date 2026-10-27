import { getProgressHubData } from "@/lib/progress-hub";
import type { ProgressTabData } from "@/lib/progress-metrics/types";

export async function loadProgressStrengthMetrics(userId: string): Promise<ProgressTabData["sila"]> {
  const { strength, intelligence } = await getProgressHubData(userId, "sila");
  return { strength, intelligence };
}
