import "server-only";

import { isConsentGranted } from "@/lib/consents";
import { getProgressHubData } from "@/lib/progress-hub";
import { buildPremiumReport, type PremiumReport } from "@/lib/premium-report";
import { requirePremium } from "@/lib/user-package";

/** Raport Premium: najpierw bramka pakietu (402), potem dane; sekcja ciała tylko za zgodą `health`. */
export async function getPremiumReport(userId: string): Promise<PremiumReport> {
  await requirePremium(userId);
  const [hub, health] = await Promise.all([
    getProgressHubData(userId, "all"),
    isConsentGranted(userId, "health"),
  ]);
  return buildPremiumReport(hub, { includeBody: health });
}
