"use client";

import { useCallback, useEffect, useState } from "react";
import { OverviewTab } from "@/components/progress/overview-tab";
import { StrengthTab } from "@/components/progress/strength-tab";
import { BodyTab } from "@/components/progress/body-tab";
import { WeekTab } from "@/components/progress/week-tab";
import { ProgressTabs } from "@/components/progress/progress-tabs";
import { hapticTap } from "@/lib/haptics";
import { plural } from "@/lib/progress-format";
import type { ProgressHubData } from "@/lib/progress-hub";
import {
  DEFAULT_PROGRESS_TAB,
  parseProgressTab,
  type ProgressTabId,
} from "@/lib/progress-tabs";

const PL_MONTH = [
  "STYCZNIA",
  "LUTEGO",
  "MARCA",
  "KWIETNIA",
  "MAJA",
  "CZERWCA",
  "LIPCA",
  "SIERPNIA",
  "WRZEŚNIA",
  "PAŹDZIERNIKA",
  "LISTOPADA",
  "GRUDNIA",
] as const;

function formatSinceKicker(iso: string | null, workouts: number): string {
  const tren = `${workouts} ${plural(workouts, "TRENING", "TRENINGI", "TRENINGÓW")}`;
  if (!iso) return tren;
  try {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return tren;
    const month = PL_MONTH[d.getMonth()] ?? "";
    return `OD ${d.getDate()} ${month} · ${tren}`;
  } catch {
    return tren;
  }
}

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
}: {
  data: ProgressHubData;
  initialTab: ProgressTabId;
}) {
  const [tab, setTab] = useState<ProgressTabId>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // Wstecz / naprzód przeglądarki (gdy ktoś pushuje historię).
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      setTab(parseProgressTab(params.get("tab")));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
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
      <p className="-mt-1 px-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
        {formatSinceKicker(data.strength.sinceDate, data.strength.workoutCount)}
      </p>

      <ProgressTabs active={tab} onTabChange={onTabChange} />

      {tab === "przeglad" ? (
        <OverviewTab data={data} onNavigate={onTabChange} />
      ) : null}
      {tab === "sila" ? (
        <StrengthTab data={data.strength} intelligence={data.intelligence} />
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
