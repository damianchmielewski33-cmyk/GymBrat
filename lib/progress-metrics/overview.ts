import { getProgressHubData } from "@/lib/progress-hub";
import type { ProgressTabData } from "@/lib/progress-metrics/types";

export async function loadProgressOverviewMetrics(userId: string): Promise<ProgressTabData["przeglad"]> {
  const { intelligence, body, week } = await getProgressHubData(userId, "przeglad");
  return { intelligence, body, week };
}
