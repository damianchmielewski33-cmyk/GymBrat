"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  CONSENT_CHANGED_EVENT,
  canUseAnalytics,
  hasConsentDecision,
} from "@/lib/consent-preferences";
import { VISITOR_ID_STORAGE_KEY } from "@/lib/constants";

const LAST_PAGE_VIEW_KEY = "gymbrat_analytics_last_pv";

function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (!id || id.length < 8) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** Rejestruje wejście na ekran (ścieżka → ekran ustala serwer). */
export function AnalyticsTracker() {
  const pathname = usePathname();
  const lastRef = useRef<{ path: string; t: number } | null>(null);
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);

  useEffect(() => {
    const sync = () => {
      setAnalyticsAllowed(hasConsentDecision() && canUseAnalytics());
    };
    sync();
    window.addEventListener(CONSENT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!pathname || !analyticsAllowed) return;
    const now = Date.now();
    const last = lastRef.current;
    if (last && last.path === pathname && now - last.t < 1500) return;
    try {
      const raw = sessionStorage.getItem(LAST_PAGE_VIEW_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { path: string; t: number };
        if (parsed.path === pathname && now - parsed.t < 1500) return;
      }
    } catch {
      /* ignore */
    }
    lastRef.current = { path: pathname, t: now };
    try {
      sessionStorage.setItem(LAST_PAGE_VIEW_KEY, JSON.stringify({ path: pathname, t: now }));
    } catch {
      /* ignore */
    }

    const visitorId = getVisitorId();
    if (!visitorId) return;

    void fetch("/api/analytics/page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathname, visitorId }),
    }).catch(() => {});
  }, [pathname, analyticsAllowed]);

  return null;
}
