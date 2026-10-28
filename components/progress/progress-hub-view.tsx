"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getBodyMetricsAction,
  getOverviewMetricsAction,
  getStrengthMetricsAction,
  getWeekMetricsAction,
} from "@/actions/progress-metrics";
import { OverviewTab } from "@/components/progress/overview-tab";
import { StrengthTab } from "@/components/progress/strength-tab";
import { BodyTab } from "@/components/progress/body-tab";
import { WeekTab } from "@/components/progress/week-tab";
import { ProgressTabs } from "@/components/progress/progress-tabs";
import { hapticTap } from "@/lib/haptics";
import type { ProgressTabData, ProgressTabPayload } from "@/lib/progress-metrics/types";
import {
  DEFAULT_PROGRESS_TAB,
  parseProgressTab,
  type ProgressTabId,
} from "@/lib/progress-tabs";

function writeTabToUrl(tab: ProgressTabId) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (tab === DEFAULT_PROGRESS_TAB) url.searchParams.delete("tab");
  else url.searchParams.set("tab", tab);
  window.history.replaceState(window.history.state, "", url.pathname + url.search);
}

export function ProgressHubView({
  initialData,
  initialTab,
  initialPeriod,
}: {
  initialData?: ProgressTabPayload;
  initialTab: ProgressTabId;
  initialPeriod: "7" | "30" | "90";
}) {
  const [tab, setTab] = useState<ProgressTabId>(initialTab);
  const [period, setPeriod] = useState<"7" | "30" | "90">(initialPeriod);
  const [cache, setCache] = useState<Partial<ProgressTabData>>(() => initialData ? ({ [initialData.tab]: initialData.data } as Partial<ProgressTabData>) : {});
  const [loading, setLoading] = useState<Partial<Record<ProgressTabId, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<ProgressTabId, string>>>({});
  const cacheRef = useRef(cache);
  const inFlightRef = useRef(new Set<ProgressTabId>());

  const loadTab = useCallback((requestedTab: ProgressTabId) => {
    if (cacheRef.current[requestedTab] || inFlightRef.current.has(requestedTab)) return;
    inFlightRef.current.add(requestedTab);
    setLoading((state) => ({ ...state, [requestedTab]: true }));
    setErrors((state) => ({ ...state, [requestedTab]: undefined }));
    const request = requestedTab === "sila"
      ? getStrengthMetricsAction()
      : requestedTab === "sylwetka"
        ? getBodyMetricsAction()
        : requestedTab === "tydzien"
          ? getWeekMetricsAction()
          : getOverviewMetricsAction();
    void request.then((data) => {
      const nextCache = { ...cacheRef.current, [requestedTab]: data } as Partial<ProgressTabData>;
      cacheRef.current = nextCache;
      setCache(nextCache);
    }).catch((error: unknown) => {
      setErrors((state) => ({ ...state, [requestedTab]: error instanceof Error ? error.message : "Nie udało się wczytać tej zakładki." }));
    }).finally(() => {
      inFlightRef.current.delete(requestedTab);
      setLoading((state) => ({ ...state, [requestedTab]: false }));
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadTab(tab), 0);
    return () => window.clearTimeout(timer);
  }, [loadTab, tab]);

  // Wstecz / naprzód przeglądarki (gdy ktoś pushuje historię).
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const nextTab = parseProgressTab(params.get("tab"));
      loadTab(nextTab);
      setTab(nextTab);
      const value = params.get("okres");
      setPeriod(value === "7" || value === "90" ? value : "30");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [loadTab]);

  const onPeriodChange = useCallback((next: "7" | "30" | "90") => {
    setPeriod(next);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (next === "30") url.searchParams.delete("okres");
    else url.searchParams.set("okres", next);
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  }, []);

  const onTabChange = useCallback(
    (next: ProgressTabId) => {
      if (next === tab) return;
      hapticTap();
      loadTab(next);
      setTab(next);
      // Bez router.replace — soft-nav Next na telefonie często nie podmieniał UI
      // i dodatkowo odpalał ponowne ładowanie całej analizy.
      writeTabToUrl(next);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    },
    [tab, loadTab],
  );

  const updatedLabel = (() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `Aktualizacja dziś, ${hh}:${mm}`;
  })();

  return (
    <div className="space-y-3.5">
      <p className="-mt-1 px-0.5 text-[12px] text-[var(--gym-text-secondary)]">
        {updatedLabel}
      </p>

      <ProgressTabs active={tab} onTabChange={onTabChange} />

      {loading[tab] || (!cache[tab] && !errors[tab]) ? (
        <div role="status" aria-label="Ładowanie zakładki" className="space-y-3">
          <div className="h-28 rounded-2xl bg-white/[0.06]" />
          <div className="h-24 rounded-2xl bg-white/[0.06]" />
          <div className="h-40 rounded-2xl bg-white/[0.06]" />
        </div>
      ) : null}
      {errors[tab] ? <div role="alert" className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-center"><p className="text-[13px] text-[var(--gym-text-secondary)]">{errors[tab]}</p><button type="button" onClick={() => loadTab(tab)} className="min-h-11 rounded-xl border border-[var(--gym-border-gold)] px-4 text-[13px] font-semibold text-white">Spróbuj ponownie</button></div> : null}
      {!loading[tab] && !errors[tab] && tab === "przeglad" && cache.przeglad ? <OverviewTab data={cache.przeglad} onNavigate={onTabChange} /> : null}
      {!loading[tab] && !errors[tab] && tab === "sila" && cache.sila ? <StrengthTab data={cache.sila.strength} intelligence={cache.sila.intelligence} period={period} onPeriodChange={onPeriodChange} /> : null}
      {!loading[tab] && !errors[tab] && tab === "sylwetka" && cache.sylwetka ? <BodyTab body={cache.sylwetka.body} /> : null}
      {!loading[tab] && !errors[tab] && tab === "tydzien" && cache.tydzien ? <WeekTab data={cache.tydzien.week} intelligence={cache.tydzien.intelligence} /> : null}
    </div>
  );
}
