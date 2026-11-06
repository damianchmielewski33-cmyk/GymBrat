import { ProgressHubView } from "@/components/progress/progress-hub-view";
import type { ProgressTabId } from "@/lib/progress-tabs";

export async function ProgressPageContent({ tab }: { tab: ProgressTabId }) {
  return <ProgressHubView initialTab={tab} />;
}
