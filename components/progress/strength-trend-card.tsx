"use client";

import { useMemo } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import {
  CollapsibleCard,
  EmptyNote,
  Explainer,
  PctValue,
  ProgressSection,
  SegmentedControl,
  StatTile,
  Surface,
  toneText,
} from "@/components/progress/progress-ui";
import {
  pickVelocity,
  velocityTone,
  type PredictionItem,
  type StrengthVelocitySnapshot,
  type VelocityPeriodKey,
} from "@/lib/analytics";
import {
  buildPredictionAggregate,
  confidenceLabelPl,
} from "@/lib/analytics/strength-movers";
import { fmtPct } from "@/lib/progress-format";
import { exerciseProgressKey } from "@/lib/progress-tabs";
import { cn } from "@/lib/utils";

type PeriodId = "7" | "30" | "90";

const PERIODS: { id: PeriodId; label: string; key: VelocityPeriodKey }[] = [
  { id: "7", label: "7 dni", key: "days7" },
  { id: "30", label: "30 dni", key: "days30" },
  { id: "90", label: "90 dni", key: "days90" },
];

/**
 * Jeden wspólny „Trend siły” z jednym przełącznikiem okresu.
 * Zastępuje trzy karty, które pokazywały to samo: licznik rośnie/stoi/spada,
 * „Tempo zmian” i „Najszybciej rośnie / spada”.
 */
export function StrengthTrendCard({
  velocity,
  period,
  onPeriodChange,
}: {
  velocity: StrengthVelocitySnapshot;
  period: PeriodId;
  onPeriodChange: (period: PeriodId) => void;
}) {
  const meta = PERIODS.find((p) => p.id === period) ?? PERIODS[1]!;
  const key = meta.key;

  const e1rm = pickVelocity(velocity.overall.e1rmPct, key);
  const volume = pickVelocity(velocity.overall.volumePct, key);

  const hasAny = e1rm != null || volume != null;

  return (
    <ProgressSection title="Podsumowanie" trailing={meta.label}>
      <Surface variant="hero" className="space-y-3">
        <SegmentedControl
          options={PERIODS}
          value={period}
          onChange={onPeriodChange}
          ariaLabel="Okres trendu siły"
        />

        {!hasAny ? (
          <p className="py-2 text-center text-[13px] text-white/45">
            Za mało historii w tym oknie — wróć po kolejnych treningach.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <StatTile
                label="e1RM (śr.)"
                value={<PctValue value={e1rm} className="text-[1.35rem]" />}
              />
              <StatTile
                label="Tonaż"
                value={<PctValue value={volume} className="text-[1.35rem]" />}
              />
            </div>

            <Explainer>
              <p>
                Procent to druga połowa wybranego okna względem pierwszej, np. w 30
                dniach: ostatnie ~15 dni vs wcześniejsze ~15. e1RM to średnia po
                ćwiczeniach; tonaż i partie to łączna objętość. Zmiana poniżej ±3%
                liczy się jako „stoi”.
              </p>
            </Explainer>
          </>
        )}
      </Surface>
    </ProgressSection>
  );
}

/** Prognoza e1RM — zwinięta, bo to dodatek do trendu, a nie główna treść. */
export function StrengthForecastCard({
  predictions,
}: {
  predictions: PredictionItem[];
}) {
  const aggregate = useMemo(() => buildPredictionAggregate(predictions), [predictions]);

  if (aggregate.count === 0) {
    return (
      <EmptyNote>
        Prognoza e1RM pojawi się po kilku tygodniach treningu (min. 8 sesji na
        ćwiczenie).
      </EmptyNote>
    );
  }

  return (
    <CollapsibleCard
      title="Prognoza e1RM"
      icon={<TrendingUp className="h-3.5 w-3.5" aria-hidden />}
      summary={`${fmtPct(aggregate.avgE1rmDeltaPct30)} za 30 dni · ${fmtPct(aggregate.avgE1rmDeltaPct90)} za 90 dni`}
    >
      <div className="space-y-3 px-3.5 py-3">
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label="e1RM za 30 dni"
            value={<PctValue value={aggregate.avgE1rmDeltaPct30} className="text-[1.2rem]" />}
          />
          <StatTile
            label="e1RM za 90 dni"
            value={<PctValue value={aggregate.avgE1rmDeltaPct90} className="text-[1.2rem]" />}
          />
        </div>

        <ul className="divide-y divide-white/[0.06]">
          {aggregate.items.slice(0, 5).map((item) => {
            const d30 = velocityTone(item.e1rmDeltaPct30);
            return (
              <li key={item.exerciseKey}>
                <Link
                  href={`/progress/exercises/${exerciseProgressKey(item.name)}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-2 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-white">
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/40">
                      teraz {item.e1rmNow.toLocaleString("pl-PL")} kg · pewność{" "}
                      {confidenceLabelPl(item.confidence)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-metric text-[13px] tabular-nums", toneText(d30))}>
                      30d {fmtPct(item.e1rmDeltaPct30)}
                    </p>
                    <p className="mt-0.5 font-metric text-[11px] tabular-nums text-white/45">
                      90d {fmtPct(item.e1rmDeltaPct90)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        <Explainer>
          <p>
            Średnie % to projekcja z regresji liniowej po sesjach (≥8). Szczegóły
            w kg są w karcie ćwiczenia.
          </p>
        </Explainer>
      </div>
    </CollapsibleCard>
  );
}
