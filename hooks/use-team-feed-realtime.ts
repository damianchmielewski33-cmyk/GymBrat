"use client";

import { useEffect, useRef } from "react";

/**
 * SSE → wywołuje onEvent (incremental fetch), bez pełnego router.refresh().
 */
export function useTeamFeedRealtime(
  teamId: string,
  enabled: boolean,
  onEvent?: () => void,
) {
  const sinceRef = useRef(Date.now());
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !teamId) return;

    let es: EventSource | null = null;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
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
        retryTimer = setTimeout(connect, 4000);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [teamId, enabled]);
}
