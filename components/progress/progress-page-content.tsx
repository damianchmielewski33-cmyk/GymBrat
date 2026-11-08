import { ProgressHubView } from "@/components/progress/progress-hub-view";
import { loadProgressBodyMetrics } from "@/lib/progress-metrics/body";
import { loadProgressOverviewMetrics } from "@/lib/progress-metrics/overview";
import { loadProgressStrengthMetrics } from "@/lib/progress-metrics/strength";
import type { ProgressTabData } from "@/lib/progress-metrics/types";
import { loadProgressWeekMetrics } from "@/lib/progress-metrics/week";
import { TAB_DATA_SCOPES, type ProgressDataScope, type ProgressTabId } from "@/lib/progress-tabs";

const SERVER_LOADERS: Record<ProgressDataScope, (userId: string) => Promise<ProgressTabData[ProgressDataScope]>> = {
  przeglad: loadProgressOverviewMetrics,
  sila: loadProgressStrengthMetrics,
  sylwetka: async (userId) => ({ body: await loadProgressBodyMetrics(userId) }),
  tydzien: loadProgressWeekMetrics,
};

/** Dane aktywnej zakładki pobieramy na serwerze (bez dodatkowego round-tripu po hydratacji). */
export async function ProgressPageContent({ tab, userId }: { tab: ProgressTabId; userId: string }) {
  const scopes = TAB_DATA_SCOPES[tab];
  const initialCache: Partial<ProgressTabData> = {};
  try {
    const results = await Promise.all(scopes.map((s) => SERVER_LOADERS[s](userId)));
    scopes.forEach((s, i) => {
      (initialCache as Record<string, unknown>)[s] = results[i];
    });
  } catch {
    // Klient spróbuje ponownie i pokaże błąd z przyciskiem „Spróbuj ponownie".
  }
  return <ProgressHubView initialTab={tab} initialCache={initialCache} />;
}
