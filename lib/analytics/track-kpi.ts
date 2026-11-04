import "server-only";

import {
  KpiEvents,
  type KpiEventName,
  type KpiEventProps,
} from "@/lib/analytics/kpi-events";
import { posthogCapture } from "@/lib/analytics/posthog";
import { isConsentGranted } from "@/lib/consents";

/**
 * Z53: zdarzenie KPI → PostHog wyłącznie przy zgodzie `analytics` zapisanej w bazie.
 * Fire-and-forget: nigdy nie rzuca i nie blokuje odpowiedzi.
 */
export function trackKpi<E extends KpiEventName>(
  event: E,
  userId: string,
  properties: KpiEventProps[E],
): void {
  if (!userId || userId === "anonymous" || userId.startsWith("system:")) return;
  void isConsentGranted(userId, "analytics")
    .then((ok) => {
      if (!ok) return;
      return posthogCapture({
        event,
        distinctId: userId,
        properties: { analytics_schema: 1, surface: "kpi", ...properties },
      });
    })
    .catch(() => undefined);
}

export { KpiEvents };
