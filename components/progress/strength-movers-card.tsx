"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import type {
  PredictionItem,
  StrengthVelocitySnapshot,
} from "@/lib/analytics";
import { formatVelocityPct, velocityTone } from "@/lib/analytics";
import {
  buildPredictionAggregate,
  buildStrengthMovers,
  confidenceLabelPl,
} from "@/lib/analytics/strength-movers";
import { exerciseProgressKey } from "@/lib/progress-tabs";
import { cn } from "@/lib/utils";

function toneClass(tone: ReturnType<typeof velocityTone>): string {
  if (tone === "up") return "text-emerald-300";
  if (tone === "down") return "text-rose-300";
  if (tone === "flat") return "text-white/55";
  return "text-white/35";
}

function ToneIcon({ tone }: { tone: ReturnType<typeof velocityTone> }) {
  if (tone === "up") {
    return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-300" aria-hidden />;
  }
  if (tone === "down") {
    return <ArrowDownRight className="h-3.5 w-3.5 text-rose-300" aria-hidden />;
  }
  return <Minus className="h-3.5 w-3.5 text-white/35" aria-hidden />;
}

function AggregateTile({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  const tone = velocityTone(value);
  return (
    <div className="rounded-xl border border-white/10 bg-black/35 px-2.5 py-2 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 inline-flex items-center justify-center gap-0.5 font-metric text-[1.2rem] leading-none tabular-nums",
          toneClass(tone),
        )}
      >
        <ToneIcon tone={tone} />
        {formatVelocityPct(value)}
      </p>
    </div>
  );
}

function MoverColumn({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "up" | "down";
  items: Array<{
    exerciseKey: string;
    name: string;
    scorePct: number;
    volumePct: number | null;
    e1rmPct: number | null;
  }>;
}) {
  const titleTone =
    tone === "up" ? "text-emerald-300/85" : "text-rose-300/85";
  const valueTone = tone === "up" ? "text-emerald-300" : "text-rose-300";

  if (items.length === 0) {
    return (
      <div className="space-y-1.5">
        <p
          className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.12em]",
            titleTone,
          )}
        >
          {title}
        </p>
        <p className="rounded-xl border border-white/[0.06] px-3 py-3 text-[12px] text-white/40">
          Brak wyraźnego {tone === "up" ? "wzrostu" : "spadku"} w 30 dniach
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.12em]",
          titleTone,
        )}
      >
        {title}
      </p>
      <ul className="overflow-hidden rounded-xl border border-white/[0.06] divide-y divide-white/[0.06]">
        {items.map((m) => (
          <li key={`${tone}-${m.exerciseKey}`}>
            <Link
              href={`/progress/exercises/${exerciseProgressKey(m.name)}`}
              className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-white/[0.03]"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-white">
                  {m.name}
                </p>
                <p className="mt-0.5 text-[10px] text-white/40">
                  obj. {formatVelocityPct(m.volumePct)}
                  <span className="mx-1 text-white/20">·</span>
                  e1RM {formatVelocityPct(m.e1rmPct)}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 font-metric text-[14px] tabular-nums",
                  valueTone,
                )}
              >
                {formatVelocityPct(m.scorePct)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PredictionRow({
  item,
}: {
  item: PredictionItem & {
    e1rmDeltaPct30: number | null;
    e1rmDeltaPct90: number | null;
  };
}) {
  const d30 = velocityTone(item.e1rmDeltaPct30);
  return (
    <li>
      <Link
        href={`/progress/exercises/${exerciseProgressKey(item.name)}`}
        className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03]"
      >
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-white">
            {item.name}
          </p>
          <p className="mt-0.5 text-[10px] text-white/40">
            teraz {item.e1rmNow.toLocaleString("pl-PL")} kg
            <span className="mx-1 text-white/20">·</span>
            pewność {confidenceLabelPl(item.confidence)}
          </p>
        </div>
        <div className="text-right">
          <p
            className={cn(
              "font-metric text-[13px] tabular-nums",
              toneClass(d30),
            )}
          >
            30d {formatVelocityPct(item.e1rmDeltaPct30)}
          </p>
          <p className="mt-0.5 font-metric text-[11px] tabular-nums text-white/45">
            90d {formatVelocityPct(item.e1rmDeltaPct90)}
          </p>
        </div>
      </Link>
    </li>
  );
}

export function StrengthMoversCard({
  velocity,
  predictions,
}: {
  velocity: StrengthVelocitySnapshot;
  predictions: PredictionItem[];
}) {
  const movers = buildStrengthMovers(velocity, 5);
  const aggregate = buildPredictionAggregate(predictions);
  const hasMovers = movers.rising.length > 0 || movers.falling.length > 0;
  const hasPredictions = aggregate.count > 0;

  if (!hasMovers && !hasPredictions) {
    return (
      <section className="space-y-2">
        <SectionLabel
          title="Najszybciej rośnie / spada"
          trailing="30 dni"
          titleTone="white"
        />
        <div className="app-panel px-3.5 py-4 text-center text-[13px] text-white/45">
          Za mało historii — po kilku tygodniach treningu pojawią się liderzy
          tempa i predykcje e1RM 30/90 dni.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3.5">
      <div className="space-y-2">
        <SectionLabel
          title="Najszybciej rośnie / spada"
          trailing="30 dni"
          titleTone="white"
        />
        <div className="space-y-3 app-panel px-3.5 py-3">
          {hasMovers ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <MoverColumn title="Rośnie" tone="up" items={movers.rising} />
              <MoverColumn title="Spada" tone="down" items={movers.falling} />
            </div>
          ) : (
            <p className="text-[13px] text-white/45">
              Brak wyraźnych liderów tempa (±3%) w ostatnich 30 dniach.
            </p>
          )}
          <p className="text-[11px] leading-snug text-white/35">
            Ranking z tempa zmian objętości (fallback: e1RM) w oknie 30 dni —
            druga połowa względem pierwszej.
          </p>
        </div>
      </div>

      {hasPredictions ? (
        <div className="space-y-2">
          <SectionLabel
            title="Predykcja e1RM"
            trailing={`${aggregate.count} ćw.`}
            titleTone="white"
          />
          <div className="space-y-3 app-panel px-3.5 py-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <AggregateTile
                label="e1RM 30d"
                value={aggregate.avgE1rmDeltaPct30}
              />
              <AggregateTile
                label="e1RM 90d"
                value={aggregate.avgE1rmDeltaPct90}
              />
              <AggregateTile
                label="Tonaż 30d"
                value={aggregate.avgTonnageDeltaPct30}
              />
              <AggregateTile
                label="Tonaż 90d"
                value={aggregate.avgTonnageDeltaPct90}
              />
            </div>

            <ul className="overflow-hidden rounded-xl border border-white/[0.06] divide-y divide-white/[0.06]">
              {aggregate.items.slice(0, 6).map((item) => (
                <PredictionRow key={item.exerciseKey} item={item} />
              ))}
            </ul>

            <p className="text-[11px] leading-snug text-white/35">
              Średnie % to projekcja z regresji liniowej po sesjach (≥8).
              Szczegóły kg są w karcie ćwiczenia.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
