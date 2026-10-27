import { ProgressHubView } from "@/components/progress/progress-hub-view";
import type { ProgressTabId } from "@/lib/progress-tabs";

export async function ProgressPageContent({
  tab,
  period,
}: {
  tab: ProgressTabId;
  period: "7" | "30" | "90";
}) {
  return <ProgressHubView initialTab={tab} initialPeriod={period} />;
}
