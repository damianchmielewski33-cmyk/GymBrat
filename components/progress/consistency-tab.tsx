"use client";

import { useMemo, useState } from "react";
import { Meter } from "@/components/progress/progress-ui";
import { Definition, MeterRow, WeekBars } from "@/components/progress/progress-charts";
import { fmtNum, formatDayMonth, plural } from "@/lib/progress-format";
import type { ProgressHubData } from "@/lib/progress-hub";
import { cn } from "@/lib/utils";

type Metric = "workouts" | "tonnageKg" | "cardioMinutes";

const METRICS: ReadonlyArray<{ id: Metric; label: string }> = [
  { id: "workouts", label: "Treningi" },
  { id: "tonnageKg", label: "Tonaż" },
  { id: "cardioMinutes", label: "Cardio" },
];

const ZONE_NAME: Record<number, string> = {
  1: "Z1 · bardzo lekko",
  2: "Z2 · spokojne tempo",
  3: "Z3 · umiarkowanie",
  4: "Z4 · ciężko",
  5: "Z5 · maksymalnie",
};

function Card({ children, hero }: { children: React.ReactNode; hero?: boolean }) {
  return (
    <section
      className={
        hero
          ? "relative overflow-hidden rounded-2xl border border-[var(--gym-gold)]/30 bg-gradient-to-b from-[rgba(var(--neon-rgb),0.14)] via-[var(--gym-surface-sunken)] to-[var(--gym-surface-sunken)] px-4 py-4"
          : "app-panel px-4 py-4"
      }
    >
      {children}
    </section>
  );
}

function CardTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
      {children}
    </h2>
  );
}

function fmtMetric(metric: Metric, v: number): string {
  if (metric === "workouts") return String(v);
  if (metric === "tonnageKg") return `${fmtNum(v / 1000, 1)}k`;
  return `${Math.round(v)}m`;
}

function fmtMetricLong(metric: Metric, v: number): string {
  if (metric === "workouts") return `${v} ${plural(v, "trening", "treningi", "treningów")}`;
  if (metric === "tonnageKg") return `${fmtNum(v, 0)} kg`;
  return `${Math.round(v)} min`;
}

const METRIC_NOTE: Record<Metric, string> = {
  workouts: "Liczba treningów siłowych w tygodniu.",
  tonnageKg: "Tonaż to suma ciężar × powtórzenia ze wszystkich serii, w tysiącach kg.",
  cardioMinutes: "Cardio w minutach.",
};

export function ConsistencyTab({
  data,
  intelligence,
}: {
  data: ProgressHubData["week"];
  intelligence: ProgressHubData["intelligence"];
}) {
  const { summary, last8, dietTraining } = data;
  const [metric, setMetric] = useState<Metric>("workouts");
  const [sel, setSel] = useState(Math.max(0, last8.length - 1));

  const totalWorkouts = last8.reduce((a, w) => a + w.workouts, 0);
  const planned = summary.target * last8.length;
  const pct = planned > 0 ? Math.min(100, Math.round((totalWorkouts / planned) * 100)) : 0;

  const items = useMemo(
    () =>
      last8.map((w, i) => {
        const v = w[metric];
        const isNow = i === last8.length - 1;
        return {
          label: isNow ? "Ten" : formatDayMonth(w.monday),
          display: fmtMetric(metric, v),
          value: v,
          aria: `Tydzień ${isNow ? "bieżący" : `od ${formatDayMonth(w.monday)}`}: ${fmtMetricLong(metric, v)}`,
        };
      }),
    [last8, metric],
  );

  const cur = last8[sel];
  const prev = sel > 0 ? last8[sel - 1] : null;
  const curV = cur ? cur[metric] : 0;
  const diff = cur && prev ? curV - prev[metric] : null;
  const diffTxt =
    diff == null
      ? ""
      : `, ${diff === 0 ? "bez zmiany" : `${diff > 0 ? "+" : "−"}${fmtMetricLong(metric, Math.abs(diff))}`} względem poprzedniego tygodnia`;
  const best = Math.max(...last8.map((w) => w[metric]));

  // Kalendarz: 8 wierszy (tygodnie) × 7 dni.
  const weeks = Array.from({ length: Math.ceil(summary.calendar8w.length / 7) }, (_, i) => summary.calendar8w.slice(i * 7, i * 7 + 7));

  const diet = dietTraining.current;
  const dietDays = diet ? Math.max(1, diet.daysLogged) : 1;
  const kcalAvg = diet ? Math.round(diet.caloriesConsumed / dietDays) : 0;
  const kcalGoalDay = diet && diet.daysInWindow > 0 ? Math.round(diet.caloriesGoal / diet.daysInWindow) : 0;
  const proteinAvg = diet ? Math.round(diet.proteinConsumed / dietDays) : 0;
  const proteinGoalDay = diet && diet.daysInWindow > 0 ? Math.round(diet.proteinGoal / diet.daysInWindow) : 0;
  const proteinGap = proteinGoalDay - proteinAvg;

  const cardio = intelligence.cardio;
  const cardioTotal = cardio.zones.reduce((a, z) => a + z.minutes, 0);
  const maxZone = Math.max(1, ...cardio.zones.map((z) => z.minutes));

  return (
    <div className="space-y-3.5">
      <Card hero>
        <CardTitle id="h-reg">Ostatnie 8 tygodni</CardTitle>
        <p className="mt-1.5 flex items-baseline gap-2">
          <span className="font-metric text-[64px] leading-none text-white">{totalWorkouts}</span>
          <span className="text-[16px] text-[var(--gym-text-secondary)]">{plural(totalWorkouts, "trening", "treningi", "treningów")} w 8 tygodniach</span>
        </p>
        <Meter pct={pct} size="lg" className="mb-1 mt-2.5" barClassName="gym-meter-gold" aria-label="Realizacja planu w 8 tygodniach" />
        <p className="text-[13px] text-[var(--gym-text-secondary)]">
          {pct}% planu ({summary.target} {plural(summary.target, "trening", "treningi", "treningów")} tygodniowo). Seria tygodni z wykonanym celem:{" "}
          <span className="text-[#efe9dc]">{summary.streakWeeks}</span>.
        </p>
        <p className="mt-1 text-[13px] text-[var(--gym-text-secondary)]">
          Ten tydzień: <span className="text-[#efe9dc]">{summary.done}</span> z {summary.target}
          {summary.daysLeft > 0 ? `, zostało ${summary.daysLeft} ${plural(summary.daysLeft, "dzień", "dni", "dni")}` : ""}.
        </p>

        <div
          className="mt-4 grid grid-cols-7 gap-1.5"
          role="img"
          aria-label={`Kalendarz ostatnich 8 tygodni: ${totalWorkouts} dni z treningiem siłowym`}
        >
          {weeks.flat().map((d, i) => (
            <i
              key={d.date}
              title={formatDayMonth(d.date)}
              className={cn(
                "pv-rise block aspect-square rounded-md border",
                d.strength
                  ? "gym-meter-gold border-[var(--gym-gold-bright)]"
                  : d.cardio
                    ? "border-[var(--gym-gold)] bg-[#1b1b1f]"
                    : "border-[#26231c] bg-[#1b1b1f]",
              )}
              style={{ animationDelay: `${i * 0.01}s`, boxShadow: d.strength && d.cardio ? "inset 0 0 0 2px #0c0c0e" : undefined }}
            />
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-7 text-center text-[12px] text-[var(--gym-text-secondary)]">
          {["pon", "wt", "śr", "czw", "pt", "sob", "nd"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[var(--gym-text-secondary)]">
          <span><b className="gym-meter-gold mr-1.5 inline-block h-3.5 w-3.5 rounded align-[-2px]" />trening</span>
          <span><b className="mr-1.5 inline-block h-3.5 w-3.5 rounded border border-[var(--gym-gold)] bg-[#1b1b1f] align-[-2px]" />cardio</span>
          <span><b className="mr-1.5 inline-block h-3.5 w-3.5 rounded border border-[#26231c] bg-[#1b1b1f] align-[-2px]" />odpoczynek</span>
        </div>
        <p className="mt-1.5 text-[12px] text-[var(--gym-text-secondary)]">Najstarszy tydzień na górze, bieżący na dole.</p>
      </Card>

      <Card>
        <CardTitle id="h-wk">Tydzień po tygodniu</CardTitle>
        <div role="group" aria-label="Wskaźnik" className="mb-4 mt-3 grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
          {METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={m.id === metric}
              onClick={() => setMetric(m.id)}
              className={cn(
                "min-h-11 rounded-lg text-[13px] font-semibold transition",
                m.id === metric ? "bg-[var(--gym-gold)]/20 text-[var(--gym-gold-bright)] shadow-[0_0_0_1px_rgba(var(--neon-rgb),0.35)]" : "text-[var(--gym-text-secondary)]",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <WeekBars items={items} selected={sel} onSelect={setSel} ariaLabel={`Wykres: ${METRICS.find((m) => m.id === metric)!.label}, ostatnie 8 tygodni`} />
        {cur ? (
          <Definition className="mt-3.5">
            <span aria-live="polite">
              <b className="text-white">{sel === last8.length - 1 ? "Ten tydzień" : `Tydzień od ${formatDayMonth(cur.monday)}`}:</b> {fmtMetricLong(metric, curV)}
              {diffTxt}. {curV === best && best > 0 ? "To najlepszy z 8 tygodni. " : ""}
              {METRIC_NOTE[metric]}
            </span>
          </Definition>
        ) : null}
      </Card>

      <Card>
        <CardTitle id="h-diet">Dieta a trening</CardTitle>
        {dietTraining.hasGoals && diet && diet.daysLogged > 0 ? (
          <div className="mt-3 space-y-4">
            <p className="text-[13px] text-[var(--gym-text-secondary)]">
              Średnio dziennie w tym tygodniu (z {diet.daysLogged} {plural(diet.daysLogged, "dnia", "dni", "dni")} z wpisem), względem Twoich celów.
            </p>
            <MeterRow
              title="Kalorie"
              right={<><span className="text-[#efe9dc]">{fmtNum(kcalAvg)}</span> / {fmtNum(kcalGoalDay)} kcal</>}
              pct={kcalGoalDay > 0 ? (kcalAvg / kcalGoalDay) * 100 : 0}
            />
            <MeterRow
              title="Białko"
              right={<><span className="text-[#efe9dc]">{fmtNum(proteinAvg)}</span> / {fmtNum(proteinGoalDay)} g</>}
              pct={proteinGoalDay > 0 ? (proteinAvg / proteinGoalDay) * 100 : 0}
              note={
                proteinGoalDay > 0 && proteinGap > 5
                  ? `Białka brakuje około ${fmtNum(proteinGap)} g dziennie. Przy treningu siłowym to częsty powód wolniejszego progresu.`
                  : proteinGoalDay > 0
                    ? "Białko w normie względem celu."
                    : undefined
              }
            />
          </div>
        ) : (
          <p className="mt-2 text-[14px] leading-snug text-[var(--gym-text-secondary)]">
            {dietTraining.hasGoals
              ? "W tym tygodniu nie ma jeszcze wpisów w dzienniku. Zapisz posiłki, a porównamy je z celami."
              : "Ustaw cele żywieniowe i zapisuj posiłki w dzienniku, żeby zobaczyć tutaj, jak dieta wpływa na trening."}
          </p>
        )}
      </Card>

      <Card>
        <CardTitle id="h-car">Cardio w tym tygodniu</CardTitle>
        <p className="mb-3.5 mt-1 text-[13px] text-[var(--gym-text-secondary)]">
          {Math.round(summary.cardioMinutes)} min. Cel: {summary.cardioGoalMinutes} min.
        </p>
        {cardioTotal > 0 ? (
          <ul className="space-y-3">
            {cardio.zones.map((z) => (
              <li key={z.zone}>
                <div className="flex items-baseline justify-between text-[14px]">
                  <span className="font-semibold text-white">{ZONE_NAME[z.zone]}</span>
                  <span className="text-[13px] text-[var(--gym-text-secondary)]">{Math.round(z.minutes)} min · {Math.round(z.sharePct)}%</span>
                </div>
                <Meter pct={(z.minutes / maxZone) * 100} size="lg" className="mt-1.5" barClassName="gym-meter-gold" aria-label={ZONE_NAME[z.zone]} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-[var(--gym-text-secondary)]">Brak cardio z tętnem w tym tygodniu, więc nie ma podziału na strefy.</p>
        )}
        <Definition className="mt-3.5">
          <b className="text-white">Strefy</b> to zakresy tętna od Z1 (bardzo lekko) do Z5 (maksymalnie). {cardio.performance.verdictLabel}
          {cardio.performance.hrThen != null && cardio.performance.hrNow != null
            ? ` Tętno na podobnym wysiłku: ${cardio.performance.hrThen} → ${cardio.performance.hrNow}.`
            : ""}
        </Definition>
      </Card>
    </div>
  );
}
