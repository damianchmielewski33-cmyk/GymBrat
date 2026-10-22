"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import type { StrengthVelocitySnapshot } from "@/lib/analytics";
import {
  formatVelocityPct,
  pickVelocity,
  velocityTone,
  type VelocityPeriodKey,
} from "@/lib/analytics";
import { cn } from "@/lib/utils";

type PeriodId = "7" | "30" | "90";

const PERIODS: { id: PeriodId; label: string; key: VelocityPeriodKey }[] = [
  { id: "7", label: "7 dni", key: "days7" },
  { id: "30", label: "30 dni", key: "days30" },
  { id: "90", label: "90 dni", key: "days90" },
];

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

function MetricTile({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  const tone = velocityTone(value);
  return (
    <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 inline-flex items-center gap-1 font-metric text-[1.35rem] leading-none tabular-nums",
          toneClass(tone),
        )}
      >
        <ToneIcon tone={tone} />
        {formatVelocityPct(value)}
      </p>
    </div>
  );
}

export function StrengthVelocityPanel({
  velocity,
}: {
  velocity: StrengthVelocitySnapshot;
}) {
  const [period, setPeriod] = useState<PeriodId>("30");
  const periodMeta = PERIODS.find((p) => p.id === period) ?? PERIODS[1]!;
  const key = periodMeta.key;

  const overallE1rm = pickVelocity(velocity.overall.e1rmPct, key);
  const overallVolume = pickVelocity(velocity.overall.volumePct, key);

  const muscles = useMemo(() => {
    return [...velocity.byMuscle]
      .map((m) => ({
        ...m,
        pct: pickVelocity(m.volumePct, key),
      }))
      .filter((m) => m.pct != null)
      .sort((a, b) => Math.abs(b.pct!) - Math.abs(a.pct!))
      .slice(0, 8);
  }, [velocity.byMuscle, key]);

  const hasAny =
    overallE1rm != null || overallVolume != null || muscles.length > 0;

  return (
    <section className="space-y-2">
      <SectionLabel
        title="Tempo zmian"
        trailing={periodMeta.label}
        titleTone="white"
      />

      <div className="space-y-3 app-panel px-3.5 py-3">
        <div
          className="flex gap-1 rounded-xl border border-white/10 bg-black/30 p-1"
          role="tablist"
          aria-label="Okres tempa zmian"
        >
          {PERIODS.map((p) => {
            const active = p.id === period;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  "flex-1 rounded-lg px-2 py-2 text-[12px] font-semibold transition",
                  active
                    ? "bg-[var(--gym-gold)]/20 text-[var(--gym-gold)] shadow-[0_0_0_1px_rgba(var(--neon-rgb),0.35)]"
                    : "text-white/45 hover:text-white/70",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {!hasAny ? (
          <p className="py-2 text-center text-[13px] text-white/45">
            Za mało historii w tym oknie — wróć po kolejnych treningach.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <MetricTile label="e1RM (śr.)" value={overallE1rm} />
              <MetricTile label="Tonaż" value={overallVolume} />
            </div>

            {muscles.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                  Partie · objętość
                </p>
                <ul className="overflow-hidden rounded-xl border border-white/[0.06] divide-y divide-white/[0.06]">
                  {muscles.map((m) => {
                    const tone = velocityTone(m.pct);
                    return (
                      <li
                        key={m.id}
                        className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2"
                      >
                        <p className="text-[13px] font-medium text-white/85">
                          {m.label}
                        </p>
                        <p
                          className={cn(
                            "inline-flex items-center gap-1 font-metric text-[13px] tabular-nums",
                            toneClass(tone),
                          )}
                        >
                          <ToneIcon tone={tone} />
                          {formatVelocityPct(m.pct)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <p className="text-[11px] leading-snug text-white/35">
              Procent = druga połowa okna względem pierwszej (np. w 30 dniach:
              ostatnie ~15 vs wcześniejsze ~15). e1RM to średnia po ćwiczeniach;
              tonaż i partie — łączna objętość. Ranking ćwiczeń jest w karcie
              „Najszybciej rośnie / spada”.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
