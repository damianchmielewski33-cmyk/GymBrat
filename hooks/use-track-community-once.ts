"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  CommunityEvents,
  type CommunityEventName,
  type CommunityEventProps,
} from "@/lib/analytics/community-events";
import { trackCommunityEvent } from "@/lib/analytics/track";

/**
 * Jednorazowy track view-eventu Community na mount (ranking / HoF).
 */
export function useTrackCommunityOnce<E extends CommunityEventName>(
  event: E,
  properties: CommunityEventProps[E] | null,
  enabled = true,
) {
  const { data } = useSession();
  const fired = useRef(false);

  useEffect(() => {
    if (!enabled || !properties || fired.current) return;
    const userId = data?.user?.id;
    if (!userId) return;
    fired.current = true;
    trackCommunityEvent(event, properties, { distinctId: userId });
  }, [data?.user?.id, enabled, event, properties]);
}

export function useTrackRankingViewed(input: {
  teamId: string;
  rankingMetric?: string | null;
  rankingSize?: number;
  enabled?: boolean;
}) {
  useTrackCommunityOnce(
    CommunityEvents.rankingViewed,
    input.enabled === false
      ? null
      : {
          team_id: input.teamId,
          ranking_metric: input.rankingMetric ?? null,
          ranking_size: input.rankingSize,
        },
    input.enabled !== false,
  );
}
