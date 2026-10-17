"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * SSE + badge unread count dla centrum powiadomień.
 */
export function useNotificationsRealtime(enabled: boolean) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [bump, setBump] = useState(0);

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch("/api/community/notifications/unread-count", {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { count?: number };
      setUnreadCount(Number(data.count ?? 0));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // Po LCP — nie konkuruj z pierwszym paintem Community.
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    const start = window.setTimeout(() => {
      if (cancelled) return;
      void refreshCount();
      poll = setInterval(() => {
        void refreshCount();
      }, 30_000);
    }, 1_200);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
      if (poll) clearInterval(poll);
    };
  }, [enabled, refreshCount]);

  useEffect(() => {
    if (!enabled) return;
    let es: EventSource | null = null;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let since = Date.now();

    const connect = () => {
      if (cancelled) return;
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
        retryTimer = setTimeout(connect, 4000);
      };
    };

    // SSE po idle — mniej równoległych requestów zaraz po nawigacji.
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

    return () => {
      cancelled = true;
      if (idleId != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) window.clearTimeout(timeoutId);
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [enabled]);

  return { unreadCount, bump, refreshCount };
}
