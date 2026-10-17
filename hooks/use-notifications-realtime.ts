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
    void refreshCount();
    const poll = setInterval(() => {
      void refreshCount();
    }, 30_000);
    return () => clearInterval(poll);
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

    connect();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [enabled]);

  return { unreadCount, bump, refreshCount };
}
