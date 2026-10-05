"use client";

import { useState } from "react";
import { Dumbbell, Flame, Medal, Scale, Trophy, Utensils } from "lucide-react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import { WeekBarChart } from "@/components/progress/week-bar-chart";
import { WeekProgressCalendarCard } from "@/components/progress/week-progress-calendar-card";
import type { AchievementIcon } from "@/lib/achievements";
import {
  dietWeekStatusLabel,
  type DietWeekStatus,
  type ProgressDietTrainingWeek,
} from "@/lib/diet-training-weeks";
import type { ProgressHubData } from "@/lib/progress-hub";
import { formatTonnes } from "@/lib/workout-history-overview";
import { cn } from "@/lib/utils";

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

function statusTone(status: DietWeekStatus): string {
  switch (status) {
    case "on_track":
      return "bg-emerald-400/15 text-emerald-300";
    case "under":
      return "bg-sky-400/15 text-sky-300";
    case "over":
      return "bg-amber-400/15 text-amber-200";
    case "no_goal":
      return "bg-white/[0.06] text-white/45";
    case "no_data":
    default:
      return "bg-white/[0.06] text-white/40";
  }
}

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  return `${n}%`;
}

function fmtIntensity(n: number | null, digits = 1): string {
  if (n == null) return "—";
  return n.toLocaleString("pl-PL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function DietTrainingCurrent({ week }: { week: ProgressDietTrainingWeek }) {
  return (
    <div className="space-y-3 app-panel px-3.5 py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Utensils className="h-4 w-4 text-[var(--gym-gold)]" aria-hidden />
          <p className="text-[13px] font-medium text-white/85">Ten tydzień</p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
            statusTone(week.status),
          )}
        >
          {dietWeekStatusLabel(week.status)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Kcal vs cel
          </p>
          <p className="mt-1.5 font-metric text-[1.85rem] leading-none text-white">
            {fmtPct(week.calorieAdherencePct)}
          </p>
          <p className="mt-1.5 text-[11px] text-white/40">
            {week.caloriesConsumed.toLocaleString("pl-PL")} /{" "}
            {week.caloriesGoal > 0
              ? week.caloriesGoal.toLocaleString("pl-PL")
              : "—"}{" "}
            kcal
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Białko vs cel
          </p>
          <p className="mt-1.5 font-metric text-[1.85rem] leading-none text-white">
            {fmtPct(week.proteinAdherencePct)}
          </p>
          <p className="mt-1.5 text-[11px] text-white/40">
            {week.proteinConsumed.toLocaleString("pl-PL")} /{" "}
            {week.proteinGoal > 0
              ? week.proteinGoal.toLocaleString("pl-PL")
              : "—"}{" "}
            g · {week.daysLogged}/{week.daysInWindow} dni
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
            Tonaż
          </p>
          <p className="mt-1 font-metric text-[1.15rem] text-white">
            {formatTonnes(week.tonnageKg)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
            Śr. RPE
          </p>
          <p className="mt-1 font-metric text-[1.15rem] text-white">
            {fmtIntensity(week.avgRpe)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
            Śr. RIR
          </p>
          <p className="mt-1 font-metric text-[1.15rem] text-white">
            {fmtIntensity(week.avgRir)}
          </p>
        </div>
      </div>
    </div>
  );
}

function DietTrainingWeekRow({ week }: { week: ProgressDietTrainingWeek }) {
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-3 px-3.5 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-medium text-white/85">{week.label}</p>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              statusTone(week.status),
            )}
          >
            {dietWeekStatusLabel(week.status)}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-white/40">
          kcal {fmtPct(week.calorieAdherencePct)}
          <span className="mx-1 text-white/25">·</span>
          B {fmtPct(week.proteinAdherencePct)}
          <span className="mx-1 text-white/25">·</span>
          {week.workouts} tr.
          {week.avgRpe != null ? (
            <>
              <span className="mx-1 text-white/25">·</span>
              RPE {fmtIntensity(week.avgRpe)}
            </>
          ) : null}
        </p>
      </div>
      <p className="shrink-0 text-right font-metric text-[14px] tabular-nums text-white">
        {formatTonnes(week.tonnageKg)}
      </p>
    </li>
  );
}

export function WeekTab({ data }: { data: ProgressHubData["week"] }) {
  const { summary, last8, dietTraining, goals, achievements } = data;
  const [showAll, setShowAll] = useState(false);
  const unlocked = achievements.filter((a) => a.unlockedAt);
  const visible = showAll ? unlocked : unlocked.slice(0, 6);

  const tonnageTonnes = Math.max(0, summary.tonnageKg) / 1000;

  return (
    <div className="space-y-5">
      <WeekProgressCalendarCard
        monday={summary.monday}
        daysLeft={summary.daysLeft}
        done={summary.done}
        target={summary.target}
        days={summary.days}
        today={summary.today}
      />

      <section className="space-y-2.5">
        <SectionLabel
          className="items-center"
          index={1}
          title="W tym tygodniu"
          titleTone="white"
        />
        <div className="space-y-3 app-panel px-3.5 py-4">
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <p className="pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                Tonaż
              </p>
              <div className="min-w-0 text-right">
                <p className="font-metric text-[1.85rem] leading-none text-white">
                  <AnimatedMetric value={tonnageTonnes} decimals={1} />
                  <span className="ml-1 text-base text-white/40">t</span>
                </p>
                <p className="mt-1.5 text-[11px] leading-snug text-white/40">
                  cały poprzedni tydzień{" "}
                  {formatTonnes(summary.prevWeekTonnageKg).replace(" t", "")} t
                </p>
              </div>
            </div>
            <div className="flex min-w-0 items-start justify-between gap-2">
              <p className="pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                Cardio
              </p>
              <div className="min-w-0 text-right">
                <p className="font-metric text-[1.85rem] leading-none text-white">
                  <AnimatedMetric value={summary.cardioMinutes} />
                  <span className="ml-1 text-base text-white/40">min</span>
                </p>
                <p className="mt-1.5 text-[11px] leading-snug text-white/40">
                  {wejscLabel(summary.cardioEntries)}
                  <span className="mx-1 text-white/25">·</span>
                  Zalecenie: {summary.cardioGoalMinutes}
                </p>
              </div>
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
        <SectionLabel
          className="items-center"
          index={2}
          title="Dieta vs trening"
          trailing="8 tyg."
          titleTone="white"
        />
        <div className="space-y-3">
          {!dietTraining.hasGoals ? (
            <div className="app-panel px-4 py-4 text-center text-sm text-white/45">
              Ustaw cele kcal/makro w Profilu — wtedy zobaczysz status „W diecie”
              obok tonażu i RPE.
            </div>
          ) : null}
          {dietTraining.current ? (
            <DietTrainingCurrent week={dietTraining.current} />
          ) : null}
          {dietTraining.weeks.length ? (
            <ul className="overflow-hidden app-panel divide-y divide-white/[0.06]">
              {dietTraining.weeks.map((w) => (
                <DietTrainingWeekRow key={w.monday} week={w} />
              ))}
            </ul>
          ) : (
            <div className="app-panel px-4 py-6 text-center text-sm text-white/45">
              Brak danych tygodniowych do porównania.
            </div>
          )}
          <p className="px-1 text-[11px] text-white/35">
            „W diecie” = kcal 85–110% celu przy ≥3 dniach z dziennika (w bieżącym
            tygodniu — proporcjonalnie do minionych dni). To nie jest tak/nie z
            raportu sylwetki.
          </p>
        </div>
      </section>

      <section className="space-y-2.5">
        <SectionLabel
          className="items-center"
          index={3}
          title="Ostatnie 8 tygodni"
          titleTone="white"
        />
        <div className="app-panel p-3.5">
          <WeekBarChart weeks={last8} />
        </div>
      </section>

      <section className="space-y-2.5">
        <SectionLabel index={4} title="Następne cele" titleTone="white" />
        <div className="space-y-3.5 app-panel px-3.5 py-4">
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
          index={5}
          title="Zdobyte"
          trailing={`${unlocked.length}`}
          titleTone="white"
        />
        {unlocked.length === 0 ? (
          <div className="app-panel px-4 py-8 text-center text-sm text-white/45">
            Trenuj dalej — osiągnięcia odblokują się automatycznie.
          </div>
        ) : (
          <ul className="overflow-hidden app-panel divide-y divide-white/[0.06]">
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
