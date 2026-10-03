"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import { WeekBarChart } from "@/components/progress/week-bar-chart";
import type { ProgressHubData } from "@/lib/progress-hub";
import { cn } from "@/lib/utils";

export function WeekTab({ data }: { data: ProgressHubData["week"] }) {
  const { summary, last8, goals, achievements } = data;
  const [showAll, setShowAll] = useState(false);
  const unlocked = achievements.filter((a) => a.unlockedAt);
  const locked = achievements.filter((a) => !a.unlockedAt);
  const visibleUnlocked = showAll ? unlocked : unlocked.slice(0, 4);
  const visibleLocked = showAll ? locked : [];

  return (
    <div className="space-y-5">
      <section className="app-card space-y-4 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
              Ten tydzień
            </p>
            <p className="mt-1 font-metric text-3xl tabular-nums text-white">
              <AnimatedMetric value={summary.done} />
              <span className="mx-1 text-xl text-white/35">z</span>
              <AnimatedMetric value={summary.target} className="text-white/70" />
            </p>
            <p className="mt-0.5 text-[11px] text-white/40">treningów siłowych</p>
          </div>
        </div>
        <div className="flex justify-between gap-1.5">
          {summary.days.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                {d.label}
              </span>
              <div
                className={cn(
                  "relative flex h-9 w-9 items-center justify-center rounded-full border",
                  d.strength
                    ? "border-[var(--gym-gold)] bg-[var(--gym-gold)]/20 shadow-[0_0_16px_rgba(235,196,74,0.25)]"
                    : "border-white/12 bg-white/[0.03]",
                )}
              >
                {d.cardio ? (
                  <span
                    className="absolute bottom-0.5 h-1.5 w-1.5 rounded-full bg-sky-400"
                    aria-label="Cardio"
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel index="01" title="W tym tygodniu" />
        <div className="grid grid-cols-3 gap-2.5">
          <div className="app-card px-3 py-3.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Tonaż
            </p>
            <p className="mt-2 font-metric text-xl tabular-nums text-white">
              <AnimatedMetric value={summary.tonnageKg} decimals={0} />
            </p>
            <p className="text-[10px] text-white/35">kg</p>
          </div>
          <div className="app-card px-3 py-3.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Cardio
            </p>
            <p className="mt-2 font-metric text-xl tabular-nums text-white">
              <AnimatedMetric value={summary.cardioMinutes} />
            </p>
            <p className="text-[10px] text-white/35">min</p>
          </div>
          <div className="app-card px-3 py-3.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Streak
            </p>
            <p className="mt-2 font-metric text-xl tabular-nums text-[var(--gym-gold)]">
              <AnimatedMetric value={summary.streakWeeks} />
            </p>
            <p className="text-[10px] text-white/35">tyg.</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel index="02" title="Ostatnie 8 tygodni" />
        <div className="app-card p-4">
          <WeekBarChart weeks={last8} />
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel index="03" title="Następne cele" />
        <div className="app-card space-y-3.5 p-4">
          {goals.length === 0 ? (
            <p className="text-sm text-white/45">Ustaw cele w profilu.</p>
          ) : (
            goals.map((g) => {
              const pct =
                g.target > 0
                  ? Math.min(100, Math.round((g.current / g.target) * 100))
                  : 0;
              return (
                <div key={g.id} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
                      {g.label}
                    </p>
                    <p className="font-metric text-sm tabular-nums text-white">
                      {g.current.toLocaleString("pl-PL")}
                      <span className="text-white/35"> / {g.target}</span>
                      <span className="ml-1 text-[10px] text-white/35">{g.unit}</span>
                    </p>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-[var(--gym-gold)] transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel
          index="04"
          title="Zdobyte"
          trailing={`${unlocked.length}/${achievements.length}`}
        />
        <ul className="space-y-2">
          {visibleUnlocked.map((a) => (
            <li key={a.id} className="app-card flex items-start gap-3 px-3.5 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10">
                <Trophy className="h-4 w-4 text-[var(--gym-gold)]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{a.title}</p>
                <p className="mt-0.5 text-[12px] text-white/45">{a.description}</p>
              </div>
            </li>
          ))}
          {visibleLocked.map((a) => (
            <li
              key={a.id}
              className="app-card flex items-start gap-3 px-3.5 py-3 opacity-45"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                <Trophy className="h-4 w-4 text-white/35" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/70">{a.title}</p>
                <p className="mt-0.5 text-[12px] text-white/35">{a.description}</p>
              </div>
            </li>
          ))}
          {unlocked.length === 0 && !showAll ? (
            <li className="app-card px-4 py-6 text-center text-sm text-white/45">
              Trenuj dalej — osiągnięcia odblokują się automatycznie.
            </li>
          ) : null}
        </ul>
        {achievements.length > 4 ? (
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
