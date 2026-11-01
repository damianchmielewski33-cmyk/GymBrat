"use client";

import { useMemo } from "react";
import { ChevronRight, Dumbbell, Flame, Medal, Scale, Trophy } from "lucide-react";
import { ExerciseGoalsEditor } from "@/components/progress/exercise-goals-editor";
import { ReadinessCard } from "@/components/progress/readiness-card";
import { WeekProgressCalendarCard } from "@/components/progress/week-progress-calendar-card";
import {
  Meter,
  CollapsibleCard,
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
 * Przegląd wg makiety UX 009: Ten tydzień → Gotowość → Postęp 30 dni → Cele.
 */
export function OverviewTab({
  data,
  onNavigate,
}: {
  data: Pick<ProgressHubData, "intelligence" | "body" | "week">;
  onNavigate: (tab: ProgressTabId) => void;
}) {
  const { intelligence, body, week } = data;

  const unlocked = useMemo(
    () =>
      week.achievements
        .filter((a) => a.unlockedAt)
        .sort((a, b) =>
          (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? ""),
        ),
    [week.achievements],
  );
  const e1rm30 = intelligence.velocity.overall.e1rmPct.days30;
  const { tempo } = body;
  const emptyFirstUse =
    week.summary.done === 0 &&
    intelligence.velocity.exercises.length === 0 &&
    body.weights.length === 0;

  const weightMeta = (() => {
    if (tempo.currentKg == null) return "Dodaj pierwszy pomiar wagi";
    const parts = [`teraz ${fmtNum(tempo.currentKg, 1)} kg`];
    if (tempo.kgPerWeekLast6 != null) {
      parts.push(
        `tempo 6 tyg. ${fmtSigned(tempo.kgPerWeekLast6, " kg/tydz.", 1)}`,
      );
    }
    return parts.join(" · ");
  })();

  return (
    <div className="space-y-5">
      <WeekProgressCalendarCard
        summary={week.summary}
        emptyFirstUse={emptyFirstUse}
        onOpenWeek={() => onNavigate("tydzien")}
      />

      {!emptyFirstUse ? (
        <div className="grid gap-5 md:grid-cols-2">
          <ProgressSection title="Gotowość" trailing="7 dni">
            <ReadinessCard data={intelligence} />
          </ProgressSection>

          <ProgressSection title="Postęp" trailing="ostatnie 30 dni">
            <Surface variant="list" className="overflow-hidden">
              <button
                type="button"
                onClick={() => onNavigate("sila")}
                className="flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-white">
                    Siła (e1RM)
                  </span>
                  <span className="mt-0.5 block text-[12px] text-[var(--gym-text-secondary)]">
                    średnio po ćwiczeniach
                  </span>
                </span>
                {e1rm30 != null ? (
                  <PctValue value={e1rm30} className="text-[15px]" />
                ) : (
                  <span className="text-[12px] text-[var(--gym-text-secondary)]">
                    Za mało danych
                  </span>
                )}
                <ChevronRight
                  className="h-4 w-4 text-[var(--gym-text-secondary)]"
                  aria-hidden
                />
              </button>
              <button
                type="button"
                onClick={() => onNavigate("sylwetka")}
                className="flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-white">
                    Waga od startu
                  </span>
                  <span className="mt-0.5 block text-[12px] text-[var(--gym-text-secondary)]">
                    {weightMeta}
                  </span>
                </span>
                {tempo.deltaFromStartKg != null ? (
                  <span className="font-metric text-[15px] tabular-nums text-white">
                    {fmtSigned(tempo.deltaFromStartKg, " kg", 1)}
                  </span>
                ) : (
                  <span className="text-[12px] text-[var(--gym-text-secondary)]">
                    Za mało danych
                  </span>
                )}
                <ChevronRight
                  className="h-4 w-4 text-[var(--gym-text-secondary)]"
                  aria-hidden
                />
              </button>
            </Surface>
            <p className="mt-1.5 text-[12px] text-[var(--gym-text-secondary)]">
              Tonaż i regularność są w zakładkach Siła i Tygodnie.
            </p>
          </ProgressSection>
        </div>
      ) : (
        <ProgressSection title="Postęp" trailing="ostatnie 30 dni">
          <p className="rounded-2xl border border-dashed border-white/12 px-3.5 py-3.5 text-center text-[13px] text-[var(--gym-text-secondary)]">
            Brak danych do pokazania. Trend pojawi się po 3 sesjach tego samego
            ćwiczenia.
          </p>
        </ProgressSection>
      )}

      {!emptyFirstUse ? (
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
                      <p className="shrink-0 text-[12px] text-[var(--gym-text-secondary)]">
                        {g.remainingLabel}
                      </p>
                    </div>
                    <Meter pct={g.progressPct} className="h-1.5" />
                  </div>
                ))}
              </Surface>
            ) : null}
            <ExerciseGoalsEditor
              targets={week.exerciseTargets}
              exerciseNames={week.exerciseNameOptions}
            />
            <CollapsibleCard
              title={
                unlocked.length
                  ? `Osiągnięcia · ${unlocked.length}`
                  : "Osiągnięcia"
              }
              summary={
                unlocked.length
                  ? `Ostatnie: ${unlocked[0]?.title ?? "—"}${
                      unlocked[0]?.unlockedAt
                        ? ` · ${formatDayMonth(unlocked[0].unlockedAt)}`
                        : ""
                    }`
                  : "Pierwsze odznaki pojawią się po kilku treningach."
              }
            >
              {unlocked.length > 0 ? (
                <Surface variant="list" className="overflow-hidden">
                  {unlocked.slice(0, 5).map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 px-3.5 py-3"
                    >
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--neon-rgb),0.12)]">
                        <AchievementGlyph icon={a.icon} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold text-white">
                          {a.title}
                        </p>
                        <p className="mt-0.5 text-[13px] text-[var(--gym-text-secondary)]">
                          {a.description}
                        </p>
                      </div>
                      {a.unlockedAt ? (
                        <p className="shrink-0 text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
                          {formatDayMonth(a.unlockedAt)}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </Surface>
              ) : (
                <p className="px-3.5 py-3 text-[13px] text-[var(--gym-text-secondary)]">
                  Zapisz kilka treningów, aby odblokować pierwsze osiągnięcia.
                </p>
              )}
            </CollapsibleCard>
          </div>
        </ProgressSection>
      ) : null}
    </div>
  );
}
