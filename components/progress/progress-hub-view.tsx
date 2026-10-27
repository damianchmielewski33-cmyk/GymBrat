"use client";

import { useCallback, useEffect, useState } from "react";
import { OverviewTab } from "@/components/progress/overview-tab";
import { StrengthTab } from "@/components/progress/strength-tab";
import { BodyTab } from "@/components/progress/body-tab";
import { WeekTab } from "@/components/progress/week-tab";
import { ProgressTabs } from "@/components/progress/progress-tabs";
import { hapticTap } from "@/lib/haptics";
import type { ProgressHubData } from "@/lib/progress-hub";
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
  data,
  initialTab,
  initialPeriod,
}: {
  data: ProgressHubData;
  initialTab: ProgressTabId;
  initialPeriod: "7" | "30" | "90";
}) {
  const [tab, setTab] = useState<ProgressTabId>(initialTab);
  const [period, setPeriod] = useState<"7" | "30" | "90">(initialPeriod);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setPeriod(initialPeriod);
  }, [initialPeriod]);

  // Wstecz / naprzód przeglądarki (gdy ktoś pushuje historię).
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      setTab(parseProgressTab(params.get("tab")));
      const value = params.get("okres");
      setPeriod(value === "7" || value === "90" ? value : "30");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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
      setTab(next);
      // Bez router.replace — soft-nav Next na telefonie często nie podmieniał UI
      // i dodatkowo odpalał ponowne ładowanie całej analizy.
      writeTabToUrl(next);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    },
    [tab],
  );

  return (
    <div className="space-y-3.5">
      <p className="-mt-1 px-0.5 text-[12px] text-[var(--gym-text-secondary)]">
        Analiza treningów i pomiarów
      </p>

      <ProgressTabs active={tab} onTabChange={onTabChange} />

      {tab === "przeglad" ? (
        <OverviewTab data={data} onNavigate={onTabChange} />
      ) : null}
      {tab === "sila" ? (
        <StrengthTab data={data.strength} intelligence={data.intelligence} period={period} onPeriodChange={onPeriodChange} />
      ) : null}
      {tab === "sylwetka" ? (
        <BodyTab body={data.body} photos={data.photos} />
      ) : null}
      {tab === "tydzien" ? (
        <WeekTab data={data.week} intelligence={data.intelligence} />
      ) : null}
    </div>
  );
}
