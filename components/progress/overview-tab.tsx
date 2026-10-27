"use client";

import { useMemo } from "react";
import { ChevronRight, Dumbbell, Flame, Medal, Scale, Trophy } from "lucide-react";
import { ReadinessCard } from "@/components/progress/readiness-card";
import { WeekProgressCalendarCard } from "@/components/progress/week-progress-calendar-card";
import {
  Meter,
  CollapsibleCard,
  EmptyNote,
  PctValue,
  ProgressSection,
  Surface,
} from "@/components/progress/progress-ui";
import type { AchievementIcon } from "@/lib/achievements";
import {
  fmtNum,
  fmtSigned,
  formatDayMonth,
} from "@/lib/progress-format";
import type { ProgressHubData } from "@/lib/progress-hub";
import type { ProgressTabId } from "@/lib/progress-tabs";

function AchievementGlyph({ icon }: { icon: AchievementIcon }) {
  const cls = "h-4 w-4 text-[var(--gym-gold)]";
  if (icon === "flame") return <Flame className={cls} aria-hidden />;
  if (icon === "dumbbell") return <Dumbbell className={cls} aria-hidden />;
  if (icon === "scale") return <Scale className={cls} aria-hidden />;
  if (icon === "ribbon") return <Medal className={cls} aria-hidden />;
  return <Trophy className={cls} aria-hidden />;
}


/**
 * Przegląd = jedno miejsce na „co jest teraz”: gotowość, tydzień, skrót trendów,
 * cele i osiągnięcia. Szczegóły (z dawnych zakładek) są w Sile / Sylwetce / Tygodniach.
 */
export function OverviewTab({
  data,
  onNavigate,
}: {
  data: ProgressHubData;
  onNavigate: (tab: ProgressTabId) => void;
}) {
  const { intelligence, body, week } = data;

  const unlocked = useMemo(
    () =>
      week.achievements
        .filter((a) => a.unlockedAt)
        .sort((a, b) => (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? "")),
    [week.achievements],
  );
  const e1rm30 = intelligence.velocity.overall.e1rmPct.days30;
  const { tempo } = body;

  return (
    <div className="space-y-5">
      <WeekProgressCalendarCard summary={week.summary} />

      <div className="grid gap-5 md:grid-cols-2">
      <ProgressSection title="Gotowość" trailing="7 dni">
        <ReadinessCard data={intelligence} />
      </ProgressSection>

      <ProgressSection title="Postęp" trailing="ostatnie 30 dni">
        <Surface variant="list" className="overflow-hidden">
          <button type="button" onClick={() => onNavigate("sila")} className="flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-left">
            <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-white">Siła (e1RM)</span><span className="mt-0.5 block text-[12px] text-[var(--gym-text-secondary)]">średnio po ćwiczeniach</span></span>
            <PctValue value={e1rm30} className="text-[15px]" /><ChevronRight className="h-4 w-4 text-[var(--gym-text-secondary)]" aria-hidden />
          </button>
          <button type="button" onClick={() => onNavigate("sylwetka")} className="flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-left">
            <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-white">Waga od startu</span><span className="mt-0.5 block text-[12px] text-[var(--gym-text-secondary)]">{tempo.currentKg != null ? `teraz ${fmtNum(tempo.currentKg, 1)} kg` : "Dodaj pierwszy pomiar wagi"}</span></span>
            {tempo.deltaFromStartKg != null ? <span className="font-metric text-[15px] tabular-nums text-white">{fmtSigned(tempo.deltaFromStartKg, " kg", 1)}</span> : <span className="text-[12px] text-[var(--gym-text-secondary)]">Za mało danych</span>}
            <ChevronRight className="h-4 w-4 text-[var(--gym-text-secondary)]" aria-hidden />
          </button>
        </Surface>
      </ProgressSection>
      </div>

      <ProgressSection title="Cele i osiągnięcia">
        <div className="space-y-2.5">
          {week.goals.length > 0 ? (
          <Surface className="space-y-3">
            {week.goals.map((g) => (
              <div key={g.id} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[13px] font-medium text-white/85">
                    {g.label}
                  </p>
                  <p className="shrink-0 text-[12px] text-white/40">
                    {g.remainingLabel}
                  </p>
                </div>
                <Meter pct={g.progressPct} className="h-2" />
              </div>
            ))}
          </Surface>
          ) : null}
          <CollapsibleCard title={unlocked.length ? `Osiągnięcia · ${unlocked.length}` : "Osiągnięcia"} summary={unlocked.length ? `Ostatnie: ${unlocked[0]?.title ?? "—"}${unlocked[0]?.unlockedAt ? ` · ${formatDayMonth(unlocked[0].unlockedAt)}` : ""}` : "Pierwsze odznaki pojawią się po kilku treningach."}>
          {unlocked.length > 0 ? (
            <Surface variant="list" className="overflow-hidden">
              {unlocked.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-3.5 py-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--neon-rgb),0.12)]">
                    <AchievementGlyph icon={a.icon} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-white">
                      {a.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/40">
                      {a.description}
                    </p>
                  </div>
                  {a.unlockedAt ? (
                    <p className="shrink-0 text-[12px] tabular-nums text-white/40">
                      {formatDayMonth(a.unlockedAt)}
                    </p>
                  ) : null}
                </div>
              ))}
            </Surface>
          ) : <p className="px-3.5 py-3 text-[13px] text-[var(--gym-text-secondary)]">Zapisz kilka treningów, aby odblokować pierwsze osiągnięcia.</p>}
          </CollapsibleCard>
        </div>
      </ProgressSection>
    </div>
  );
}
