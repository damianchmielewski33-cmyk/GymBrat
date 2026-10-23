"use client";

import { useMemo, useState } from "react";
import { Dumbbell, Flame, Medal, Scale, Trophy } from "lucide-react";
import { ReadinessCard } from "@/components/progress/readiness-card";
import { WeekProgressCalendarCard } from "@/components/progress/week-progress-calendar-card";
import {
  Meter,
  ProgressSection,
  StatTile,
  Surface,
  toneText,
} from "@/components/progress/progress-ui";
import { velocityTone } from "@/lib/analytics";
import type { AchievementIcon } from "@/lib/achievements";
import {
  fmtNum,
  fmtPct,
  fmtSigned,
  formatDayMonth,
  plural,
} from "@/lib/progress-format";
import type { ProgressHubData } from "@/lib/progress-hub";
import type { ProgressTabId } from "@/lib/progress-tabs";
import { cn } from "@/lib/utils";

function AchievementGlyph({ icon }: { icon: AchievementIcon }) {
  const cls = "h-4 w-4 text-[var(--gym-gold)]";
  if (icon === "flame") return <Flame className={cls} aria-hidden />;
  if (icon === "dumbbell") return <Dumbbell className={cls} aria-hidden />;
  if (icon === "scale") return <Scale className={cls} aria-hidden />;
  if (icon === "ribbon") return <Medal className={cls} aria-hidden />;
  return <Trophy className={cls} aria-hidden />;
}

const ACHIEVEMENTS_PREVIEW = 3;

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
  const [showAll, setShowAll] = useState(false);

  const unlocked = useMemo(
    () =>
      week.achievements
        .filter((a) => a.unlockedAt)
        .sort((a, b) => (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? "")),
    [week.achievements],
  );
  const visible = showAll ? unlocked : unlocked.slice(0, ACHIEVEMENTS_PREVIEW);

  const e1rm30 = intelligence.velocity.overall.e1rmPct.days30;
  const tonnage30 = intelligence.velocity.overall.volumePct.days30;
  const month = intelligence.consistency.month;
  const { tempo } = body;

  return (
    <div className="space-y-3.5">
      <ReadinessCard data={intelligence} />

      <WeekProgressCalendarCard summary={week.summary} />

      <ProgressSection title="Trendy" trailing="ostatnie 30 dni">
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label="Siła · e1RM"
            value={fmtPct(e1rm30)}
            valueClassName={toneText(velocityTone(e1rm30))}
            hint="średnio po ćwiczeniach"
            onClick={() => onNavigate("sila")}
          />
          <StatTile
            label="Tonaż"
            value={fmtPct(tonnage30)}
            valueClassName={toneText(velocityTone(tonnage30))}
            hint="łączna objętość"
            onClick={() => onNavigate("sila")}
          />
          <StatTile
            label="Waga od startu"
            value={
              <>
                {fmtSigned(tempo.deltaFromStartKg, "", 1)}
                <span className="ml-1 text-[11px] text-white/40">kg</span>
              </>
            }
            hint={
              tempo.currentKg != null
                ? `teraz ${fmtNum(tempo.currentKg, 1)} kg`
                : "brak raportów wagi"
            }
            onClick={() => onNavigate("sylwetka")}
          />
          <StatTile
            label="Regularność"
            value={`${month.scorePct}%`}
            hint={`${month.done} z ${month.planned} ${plural(month.planned, "treningu", "treningów", "treningów")}`}
            onClick={() => onNavigate("tydzien")}
          />
        </div>
      </ProgressSection>

      {week.goals.length > 0 ? (
        <ProgressSection title="Następne cele">
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
        </ProgressSection>
      ) : null}

      <ProgressSection title="Zdobyte" trailing={unlocked.length}>
        {unlocked.length === 0 ? (
          <Surface className="py-6 text-center text-[13px] text-white/45">
            Trenuj dalej — osiągnięcia odblokują się automatycznie.
          </Surface>
        ) : (
          <>
            <Surface variant="list" className="overflow-hidden">
              {visible.map((a) => (
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
            {unlocked.length > ACHIEVEMENTS_PREVIEW ? (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className={cn(
                  "w-full text-center text-[11px] font-semibold uppercase tracking-[0.16em]",
                  "text-white/45 hover:text-white/70",
                )}
              >
                {showAll ? "Pokaż mniej" : `Pokaż wszystkie (${unlocked.length})`}
              </button>
            ) : null}
          </>
        )}
      </ProgressSection>
    </div>
  );
}
