"use client";

import { useState } from "react";
import { Dumbbell, Flame, Medal, Scale, Trophy } from "lucide-react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import { WeekBarChart } from "@/components/progress/week-bar-chart";
import type { AchievementIcon } from "@/lib/achievements";
import type { ProgressHubData } from "@/lib/progress-hub";
import { formatHistoryWeekRange, formatTonnes } from "@/lib/workout-history-overview";
import { cn } from "@/lib/utils";

function daysLeftLabel(n: number): string {
  if (n <= 0) return "tydzień się kończy";
  if (n === 1) return "został 1 dzień";
  if (n >= 2 && n <= 4) return `zostało ${n} dni`;
  return `zostało ${n} dni`;
}

function wejscLabel(n: number): string {
  if (n === 1) return "1 wejście";
  if (n >= 2 && n <= 4) return `${n} wejścia`;
  return `${n} wejść`;
}

function formatDayMonth(iso: string) {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
}

function AchievementGlyph({ icon }: { icon: AchievementIcon }) {
  const cls = "h-4 w-4 text-[var(--gym-gold)]";
  if (icon === "flame") return <Flame className={cls} aria-hidden />;
  if (icon === "dumbbell") return <Dumbbell className={cls} aria-hidden />;
  if (icon === "scale") return <Scale className={cls} aria-hidden />;
  if (icon === "ribbon") return <Medal className={cls} aria-hidden />;
  return <Trophy className={cls} aria-hidden />;
}

export function WeekTab({ data }: { data: ProgressHubData["week"] }) {
  const { summary, last8, goals, achievements } = data;
  const [showAll, setShowAll] = useState(false);
  const unlocked = achievements.filter((a) => a.unlockedAt);
  const visible = showAll ? unlocked : unlocked.slice(0, 6);

  const tonnageTonnes = Math.max(0, summary.tonnageKg) / 1000;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--gym-gold)]/30 bg-gradient-to-b from-[rgba(var(--neon-rgb),0.14)] via-[var(--gym-surface-sunken)] to-[var(--gym-surface-sunken)] p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
            {formatHistoryWeekRange(summary.monday)}
          </p>
          <p className="text-[11px] text-white/40">
            {daysLeftLabel(summary.daysLeft)}
          </p>
        </div>

        <p className="mt-3 flex items-baseline gap-2">
          <AnimatedMetric
            value={summary.done}
            className="text-[2.75rem] leading-none text-white"
          />
          <span className="text-[15px] text-white/55">
            z {summary.target} treningów
          </span>
        </p>

        <div className="mt-4 flex justify-between gap-1">
          {summary.days.map((d) => {
            const isToday = d.date === summary.today;
            return (
              <div
                key={d.date}
                className="flex flex-1 flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider",
                    d.strength || isToday ? "text-white/70" : "text-white/35",
                  )}
                >
                  {d.label}
                </span>
                <div className="relative flex h-10 w-10 items-center justify-center">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border",
                      d.strength
                        ? "border-[var(--gym-gold)] bg-[var(--gym-gold)] text-black"
                        : isToday
                          ? "border-[var(--gym-gold)]/80 bg-transparent"
                          : "border-white/12 bg-white/[0.03]",
                    )}
                  />
                  {d.cardio ? (
                    <span
                      className="absolute -bottom-0.5 h-1.5 w-1.5 rounded-full bg-sky-400"
                      aria-label="Cardio"
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-3.5 text-[11px] text-white/40">
          Złote kółko — trening, niebieska kropka — cardio.
        </p>
      </section>

      <section className="space-y-2.5">
        <SectionLabel index={1} title="W tym tygodniu" titleTone="white" />
        <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-[var(--gym-surface-sunken)] px-3.5 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                Tonaż
              </p>
              <p className="mt-1.5 font-metric text-[1.85rem] leading-none text-white">
                <AnimatedMetric value={tonnageTonnes} decimals={1} />
                <span className="ml-1 text-base text-white/40">t</span>
              </p>
              <p className="mt-1.5 text-[11px] text-white/40">
                cały poprzedni tydzień {formatTonnes(summary.prevWeekTonnageKg).replace(" t", "")} t
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                Cardio
              </p>
              <p className="mt-1.5 font-metric text-[1.85rem] leading-none text-white">
                <AnimatedMetric value={summary.cardioMinutes} />
                <span className="ml-1 text-base text-white/40">min</span>
              </p>
              <p className="mt-1.5 text-[11px] text-white/40">
                {wejscLabel(summary.cardioEntries)}
                <span className="mx-1 text-white/25">·</span>
                Zalecenie: {summary.cardioGoalMinutes}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-white/[0.06] pt-3">
            <Flame className="h-4 w-4 text-[var(--gym-gold)]" aria-hidden />
            <p className="text-[13px] text-white/80">
              {summary.streakWeeks === 0
                ? "Brak serii tygodni z treningiem"
                : summary.streakWeeks === 1
                  ? "1 tydzień z rzędu z treningiem"
                  : summary.streakWeeks >= 2 && summary.streakWeeks <= 4
                    ? `${summary.streakWeeks} tygodnie z rzędu z treningiem`
                    : `${summary.streakWeeks} tygodni z rzędu z treningiem`}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-2.5">
        <SectionLabel index={2} title="Ostatnie 8 tygodni" titleTone="white" />
        <div className="rounded-2xl border border-white/[0.06] bg-[var(--gym-surface-sunken)] p-3.5">
          <WeekBarChart weeks={last8} />
        </div>
      </section>

      <section className="space-y-2.5">
        <SectionLabel index={3} title="Następne cele" titleTone="white" />
        <div className="space-y-3.5 rounded-2xl border border-white/[0.06] bg-[var(--gym-surface-sunken)] px-3.5 py-4">
          {goals.map((g) => (
            <div key={g.id} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[13px] font-medium text-white/85">{g.label}</p>
                <p className="shrink-0 text-[12px] text-white/40">
                  {g.remainingLabel}
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-[var(--gym-gold)] transition-[width] duration-500"
                  style={{ width: `${g.progressPct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2.5">
        <SectionLabel
          index={4}
          title="Zdobyte"
          trailing={`${unlocked.length}`}
          titleTone="white"
        />
        {unlocked.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-[var(--gym-surface-sunken)] px-4 py-8 text-center text-sm text-white/45">
            Trenuj dalej — osiągnięcia odblokują się automatycznie.
          </div>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[var(--gym-surface-sunken)] divide-y divide-white/[0.06]">
            {visible.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 px-3.5 py-3.5"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--neon-rgb),0.12)]">
                  <AchievementGlyph icon={a.icon} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-white">{a.title}</p>
                  <p className="mt-0.5 text-[11px] text-white/40">
                    {a.description}
                  </p>
                </div>
                {a.unlockedAt ? (
                  <p className="shrink-0 text-[12px] tabular-nums text-white/40">
                    {formatDayMonth(a.unlockedAt)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {unlocked.length > 6 ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="w-full text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45 hover:text-white/70"
          >
            {showAll ? "Pokaż mniej" : "Pokaż więcej"}
          </button>
        ) : null}
      </section>
    </div>
  );
}
