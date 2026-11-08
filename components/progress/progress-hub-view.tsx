"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getBodyMetricsAction,
  getOverviewMetricsAction,
  getStrengthMetricsAction,
  getWeekMetricsAction,
} from "@/actions/progress-metrics";
import { SummaryTab } from "@/components/progress/summary-tab";
import { StrengthTab } from "@/components/progress/strength-tab";
import { BodyTab } from "@/components/progress/body-tab";
import { ConsistencyTab } from "@/components/progress/consistency-tab";
import { CompareTab } from "@/components/progress/compare-tab";
import { ProgressTabs } from "@/components/progress/progress-tabs";
import { hapticTap } from "@/lib/haptics";
import type { ProgressTabData } from "@/lib/progress-metrics/types";
import {
  DEFAULT_PROGRESS_TAB,
  TAB_DATA_SCOPES,
  parseProgressTab,
  type ProgressDataScope,
  type ProgressTabId,
} from "@/lib/progress-tabs";

function writeTabToUrl(tab: ProgressTabId) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (tab === DEFAULT_PROGRESS_TAB) url.searchParams.delete("tab");
  else url.searchParams.set("tab", tab);
  url.searchParams.delete("okres");
  window.history.replaceState(window.history.state, "", url.pathname + url.search);
}

const LOADERS: Record<ProgressDataScope, () => Promise<ProgressTabData[ProgressDataScope]>> = {
  przeglad: getOverviewMetricsAction,
  sila: getStrengthMetricsAction,
  sylwetka: getBodyMetricsAction,
  tydzien: getWeekMetricsAction,
};

export function ProgressHubView({
  initialTab,
  initialCache = {},
}: {
  initialTab: ProgressTabId;
  initialCache?: Partial<ProgressTabData>;
}) {
  const [tab, setTab] = useState<ProgressTabId>(initialTab);
  const [cache, setCache] = useState<Partial<ProgressTabData>>(initialCache);
  const [errors, setErrors] = useState<Partial<Record<ProgressDataScope, string>>>({});
  const cacheRef = useRef(cache);
  const inFlightRef = useRef(new Set<ProgressDataScope>());

  const loadScope = useCallback((scope: ProgressDataScope) => {
    if (cacheRef.current[scope] || inFlightRef.current.has(scope)) return;
    inFlightRef.current.add(scope);
    setErrors((state) => ({ ...state, [scope]: undefined }));
    void LOADERS[scope]()
      .then((data) => {
        const next = { ...cacheRef.current, [scope]: data } as Partial<ProgressTabData>;
        cacheRef.current = next;
        setCache(next);
      })
      .catch((error: unknown) => {
        setErrors((state) => ({
          ...state,
          [scope]: error instanceof Error ? error.message : "Nie udało się wczytać tej zakładki.",
        }));
      })
      .finally(() => {
        inFlightRef.current.delete(scope);
      });
  }, []);

  const loadTab = useCallback(
    (t: ProgressTabId) => {
      for (const scope of TAB_DATA_SCOPES[t]) loadScope(scope);
    },
    [loadScope],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => loadTab(tab), 0);
    return () => window.clearTimeout(timer);
  }, [loadTab, tab]);

  // Wstecz / naprzód przeglądarki.
  useEffect(() => {
    const onPopState = () => {
      const nextTab = parseProgressTab(new URLSearchParams(window.location.search).get("tab"));
      loadTab(nextTab);
      setTab(nextTab);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [loadTab]);

  const onTabChange = useCallback(
    (next: ProgressTabId) => {
      if (next === tab) return;
      hapticTap();
      loadTab(next);
      setTab(next);
      writeTabToUrl(next);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" });
    },
    [tab, loadTab],
  );

  const scopes = TAB_DATA_SCOPES[tab];
  const error = scopes.map((s) => errors[s]).find(Boolean);
  const ready = scopes.every((s) => cache[s]);

  return (
    <div className="space-y-3.5">
      <ProgressTabs active={tab} onTabChange={onTabChange} />

      {!error && !ready ? (
        <div role="status" aria-label="Ładowanie zakładki" className="space-y-3">
          <div className="h-28 rounded-2xl bg-white/[0.06]" />
          <div className="h-24 rounded-2xl bg-white/[0.06]" />
          <div className="h-40 rounded-2xl bg-white/[0.06]" />
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-center">
          <p className="text-[14px] text-[var(--gym-text-secondary)]">{error}</p>
          <button
            type="button"
            onClick={() => loadTab(tab)}
            className="min-h-11 rounded-xl border border-[var(--gym-border-gold)] px-4 text-[14px] font-semibold text-white"
          >
            Spróbuj ponownie
          </button>
        </div>
      ) : null}
      {ready && tab === "podsumowanie" && cache.przeglad ? <SummaryTab data={cache.przeglad} onNavigate={onTabChange} /> : null}
      {ready && tab === "sila" && cache.sila ? <StrengthTab data={cache.sila.strength} intelligence={cache.sila.intelligence} /> : null}
      {ready && tab === "cialo" && cache.sylwetka ? <BodyTab body={cache.sylwetka.body} /> : null}
      {ready && tab === "regularnosc" && cache.tydzien ? (
        <ConsistencyTab data={cache.tydzien.week} intelligence={cache.tydzien.intelligence} />
      ) : null}
      {ready && tab === "porownanie" && cache.tydzien && cache.sila ? (
        <CompareTab week={cache.tydzien.week} strength={cache.sila.strength} />
      ) : null}
    </div>
  );
}
