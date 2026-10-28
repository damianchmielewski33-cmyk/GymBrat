"use client";

import { useState } from "react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { WeekBarChart } from "@/components/progress/week-bar-chart";
import { WeekOverWeekCard } from "@/components/progress/week-over-week-card";
import {
  CollapsibleCard,
  EmptyNote,
  Eyebrow,
  Explainer,
  ProgressSection,
  StatTile,
  Surface,
} from "@/components/progress/progress-ui";
import type { ProgressIntelligence } from "@/lib/analytics";
import {
  dietWeekStatusLabel,
  type DietWeekStatus,
  type ProgressDietTrainingWeek,
} from "@/lib/diet-training-weeks";
import { fmtNum } from "@/lib/progress-format";
import type { ProgressHubData } from "@/lib/progress-hub";
import { formatTonnes } from "@/lib/workout-history-overview";
import { cn } from "@/lib/utils";

const WEEKS_PREVIEW = 4;

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

function fmtPctPlain(n: number | null): string {
  return n == null ? "—" : `${n}%`;
}

function fmtIntensity(n: number | null): string {
  return n == null ? "—" : fmtNum(n, 1);
}

function StatusPill({ status }: { status: DietWeekStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
        statusTone(status),
      )}
    >
      {dietWeekStatusLabel(status)}
    </span>
  );
}

/** Bieżący tydzień diety — tylko zgodność z celami (tonaż/RPE są w porównaniu tygodni i wykresie). */
function DietTrainingCurrent({ week }: { week: ProgressDietTrainingWeek }) {
  return (
    <Surface className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold leading-snug text-white/90">
          Ten tydzień
        </p>
        <StatusPill status={week.status} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label="Kcal vs cel"
          value={fmtPctPlain(week.calorieAdherencePct)}
          hint={`${week.caloriesConsumed.toLocaleString("pl-PL")} / ${
            week.caloriesGoal > 0 ? week.caloriesGoal.toLocaleString("pl-PL") : "—"
          } kcal`}
        />
        <StatTile
          label="Białko vs cel"
          value={fmtPctPlain(week.proteinAdherencePct)}
          hint={`${week.proteinConsumed.toLocaleString("pl-PL")} / ${
            week.proteinGoal > 0 ? week.proteinGoal.toLocaleString("pl-PL") : "—"
          } g · ${week.daysLogged}/${week.daysInWindow} dni`}
        />
      </div>
    </Surface>
  );
}

function DietTrainingWeekRow({ week }: { week: ProgressDietTrainingWeek }) {
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-3 px-3.5 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-medium text-white/85">{week.label}</p>
          <StatusPill status={week.status} />
        </div>
        <p className="mt-1 text-[11px] text-white/40">
          kcal {fmtPctPlain(week.calorieAdherencePct)}
          <span className="mx-1 text-white/25">·</span>
          B {fmtPctPlain(week.proteinAdherencePct)}
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
      <p className="shrink-0 text-right font-heading text-[14px] tabular-nums text-white">
        {formatTonnes(week.tonnageKg)}
      </p>
    </li>
  );
}

function DietTrainingSection({
  block,
}: {
  block: ProgressHubData["week"]["dietTraining"];
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? block.weeks : block.weeks.slice(0, WEEKS_PREVIEW);

  return (
    <ProgressSection title="Dieta a trening" trailing="8 tyg.">
      <div className="space-y-2">
        {!block.hasGoals ? (
          <Surface className="text-center text-[13px] text-white/45">
            Ustaw cele kcal/makro w Profilu — wtedy zobaczysz status „W diecie”
            obok tonażu i RPE.
          </Surface>
        ) : null}

        {block.current ? <DietTrainingCurrent week={block.current} /> : null}

        {block.weeks.length ? (
          <>
            <ul className="app-panel divide-y divide-white/[0.06]">
              {rows.map((w) => (
                <DietTrainingWeekRow key={w.monday} week={w} />
              ))}
            </ul>
            {block.weeks.length > WEEKS_PREVIEW ? (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="w-full text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45 hover:text-white/70"
              >
                {showAll ? "Pokaż mniej" : `Pokaż wszystkie (${block.weeks.length})`}
              </button>
            ) : null}
          </>
        ) : (
          <Surface className="py-4 text-center text-[13px] text-white/45">
            Brak danych tygodniowych do porównania.
          </Surface>
        )}

        <Explainer>
          <p>
            „W diecie” = kcal 85–110% celu przy ≥3 dniach z dziennika (w bieżącym
            tygodniu — proporcjonalnie do minionych dni). To nie jest tak/nie z
            raportu sylwetki.
          </p>
        </Explainer>
      </div>
    </ProgressSection>
  );
}

function CardioSection({ cardio }: { cardio: ProgressIntelligence["cardio"] }) {
  const verdictTone =
    cardio.performance.verdict === "improved"
      ? "text-emerald-300"
      : cardio.performance.verdict === "declined"
        ? "text-[var(--gym-text-secondary)]"
        : cardio.performance.verdict === "stable"
          ? "text-white/55"
          : "text-white/40";

  return (
    <ProgressSection title="Cardio" trailing="strefy tętna">
      <Surface className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label="Obciążenie"
            value={<AnimatedMetric value={cardio.load} decimals={0} />}
            hint={cardio.loadLabel}
          />
          <StatTile
            label="Kcal (tydzień)"
            value={cardio.caloriesEstimatedWeek.toLocaleString("pl-PL")}
            hint={cardio.hrMax != null ? `HRmax ≈ ${cardio.hrMax}` : undefined}
          />
        </div>

        <div className="space-y-1.5">
          <Eyebrow>Minuty w strefach</Eyebrow>
          <div className="grid grid-cols-5 gap-1.5">
            {cardio.zones.map((z) => (
              <div key={z.zone} className="text-center">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">
                  Z{z.zone}
                </p>
                <p className="mt-0.5 font-heading text-[13px] tabular-nums text-white">
                  {Math.round(z.minutes)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className={cn("text-[12px] leading-snug", verdictTone)}>
          {cardio.performance.verdictLabel}
          {cardio.performance.hrThen != null && cardio.performance.hrNow != null
            ? ` · HR ${cardio.performance.hrThen} → ${cardio.performance.hrNow}`
            : ""}
        </p>
      </Surface>
    </ProgressSection>
  );
}

function AdherenceSection({
  adherence,
  consistency,
}: Pick<ProgressIntelligence, "adherence" | "consistency">) {
  return (
    <ProgressSection title="Realizacja i regularność">
      <Surface className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              { label: "Łącznie", value: adherence.overallPct },
              { label: "Trening", value: adherence.trainingPct },
              { label: "Dieta", value: adherence.dietPct },
              { label: "Cardio", value: adherence.cardioPct },
            ] as const
          ).map((cell) => (
            <div key={cell.label} className="text-center">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">
                {cell.label}
              </p>
              <p className="mt-1 font-metric text-[1.15rem] tabular-nums text-white">
                {cell.value != null ? `${cell.value}%` : "—"}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-2.5">
          {(
            [
              { label: "Tydzień", w: consistency.week },
              { label: "30 dni", w: consistency.month },
              { label: "90 dni", w: consistency.days90 },
            ] as const
          ).map(({ label, w }) => (
            <div key={label} className="text-center">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">
                {label}
              </p>
              <p className="mt-1 font-metric text-[1.15rem] tabular-nums text-[var(--gym-gold)]">
                {w.scorePct}%
              </p>
              <p className="text-[10px] tabular-nums text-white/35">
                {w.done}/{w.planned}
              </p>
            </div>
          ))}
        </div>
      </Surface>
    </ProgressSection>
  );
}

/**
 * Tygodnie = historia i porównania. Bieżący tydzień (kalendarz, tonaż, seria)
 * jest w Przeglądzie, a osiągnięcia i cele — również tam.
 */
export function WeekTab({
  data,
  intelligence,
}: {
  data: ProgressHubData["week"];
  intelligence: ProgressIntelligence;
}) {
  const { summary, last8, dietTraining } = data;
  const canCompare =
    summary.compareWeeks?.length >= 2 || summary.weekCompare?.metrics?.length;

  return (
    <div className="space-y-5">
      {canCompare ? (
        <WeekOverWeekCard
          weeks={summary.compareWeeks ?? []}
          initialCompare={summary.weekCompare}
        />
      ) : (
        <ProgressSection title="Porównanie tygodni">
          <EmptyNote>Porównanie pojawi się po zapisaniu danych z kolejnego tygodnia.</EmptyNote>
        </ProgressSection>
      )}

      <ProgressSection title="Ostatnie 8 tygodni">
        <Surface className="p-3">
          <WeekBarChart weeks={last8} />
        </Surface>
      </ProgressSection>

      <AdherenceSection
        adherence={intelligence.adherence}
        consistency={intelligence.consistency}
      />

      <CollapsibleCard title="Dieta i cardio" summary="Dziennik, makroskładniki i strefy tętna" lazy>
        <div className="space-y-5 p-3.5">
          <DietTrainingSection block={dietTraining} />
          <CardioSection cardio={intelligence.cardio} />
        </div>
      </CollapsibleCard>
    </div>
  );
}
