import "server-only";

import {
  type CommunityEventName,
  type CommunityEventProps,
} from "@/lib/analytics/community-events";
import { createTrack, emitCommunityEvent } from "@/lib/analytics/track";
import { isConsentGranted } from "@/lib/consents";

/**
 * Zdarzenia Community z serwera → PostHog wyłącznie dla użytkownika, który ma w bazie
 * aktualną zgodę `analytics` (Z12). Brak zgody, konto systemowe lub "anonymous" → nic nie wychodzi.
 */
export function trackCommunityEventServer<E extends CommunityEventName>(
  event: E,
  properties: CommunityEventProps[E],
  opts: { distinctId: string; teamId?: string | null },
): void {
  const id = opts.distinctId;
  if (!id || id === "anonymous" || id.startsWith("system:")) return;
  void isConsentGranted(id, "analytics")
    .then((ok) => {
      if (ok) emitCommunityEvent(event, properties, opts);
    })
    .catch(() => undefined);
}

export const track = createTrack(trackCommunityEventServer);
