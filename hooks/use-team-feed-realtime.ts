"use client";

import { useEffect, useRef } from "react";
import {
  CLIENT_POLL,
  getCommunityRealtimeMode,
} from "@/lib/community/realtime-config";
import { useVisibilityInterval } from "@/hooks/use-visibility-interval";

/**
 * Odświeżenie tablicy: domyślnie poll; SSE tylko przy REALTIME=sse.
 */
export function useTeamFeedRealtime(
  teamId: string,
  enabled: boolean,
  onEvent?: () => void,
) {
  const sinceRef = useRef(Date.now());
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const mode = getCommunityRealtimeMode();

  useVisibilityInterval(
    () => {
      onEventRef.current?.();
    },
    CLIENT_POLL.feedMs,
    enabled && Boolean(teamId) && mode === "poll",
  );

  useEffect(() => {
    if (!enabled || !teamId || mode !== "sse") return;

    let es: EventSource | null = null;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") {
        retryTimer = setTimeout(connect, 5_000);
        return;
      }
      es = new EventSource(
        `/api/community/teams/${teamId}/feed/stream?since=${sinceRef.current}`,
      );

      es.addEventListener("feed", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as {
            since?: number;
            events?: Array<{ kind: string }>;
          };
          if (typeof data.since === "number") sinceRef.current = data.since;
          if (data.events && data.events.length > 0) {
            onEventRef.current?.();
          }
        } catch {
          /* ignore malformed */
        }
      });

      es.onerror = () => {
        es?.close();
        es = null;
        if (cancelled) return;
        retryTimer = setTimeout(connect, 8_000);
      };
    };

    connect();

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        es?.close();
        es = null;
      } else if (!es && !cancelled) {
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [teamId, enabled, mode]);
}
