"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CLIENT_POLL,
  getCommunityRealtimeMode,
} from "@/lib/community/realtime-config";
import { useVisibilityInterval } from "@/hooks/use-visibility-interval";

/**
 * Badge unread + odświeżenie listy.
 * Domyślnie HTTP poll (krótkie requesty) — bez długotrwałego SSE.
 */
export function useNotificationsRealtime(enabled: boolean) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [bump, setBump] = useState(0);
  const mode = getCommunityRealtimeMode();

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch("/api/community/notifications/unread-count", {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { count?: number };
      const next = Number(data.count ?? 0);
      setUnreadCount((prev) => {
        if (prev !== next) {
          queueMicrotask(() => setBump((n) => n + 1));
        }
        return next;
      });
    } catch {
      /* ignore */
    }
  }, []);

  useVisibilityInterval(
    () => {
      void refreshCount();
    },
    CLIENT_POLL.notificationsMs,
    enabled,
  );

  useEffect(() => {
    if (!enabled || mode !== "sse") return;
    let es: EventSource | null = null;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let since = Date.now();

    const connect = () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") {
        retryTimer = setTimeout(connect, 5_000);
        return;
      }
      es = new EventSource(
        `/api/community/notifications/stream?since=${since}`,
      );

      es.addEventListener("notification", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as {
            since?: number;
            unreadCount?: number;
          };
          if (typeof data.since === "number") since = data.since;
          if (typeof data.unreadCount === "number") {
            setUnreadCount(data.unreadCount);
          }
          setBump((n) => n + 1);
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("ping", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as {
            unreadCount?: number;
          };
          if (typeof data.unreadCount === "number") {
            setUnreadCount(data.unreadCount);
          }
        } catch {
          /* ignore */
        }
      });

      es.onerror = () => {
        es?.close();
        es = null;
        if (cancelled) return;
        retryTimer = setTimeout(connect, 8_000);
      };
    };

    const startSse = () => {
      if (cancelled) return;
      connect();
    };
    let idleId: number | null = null;
    let timeoutId: number | null = null;
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(startSse, { timeout: 2_500 });
    } else {
      timeoutId = window.setTimeout(startSse, 1_800);
    }

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
      if (idleId != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) window.clearTimeout(timeoutId);
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [enabled, mode]);

  return { unreadCount, bump, refreshCount };
}
