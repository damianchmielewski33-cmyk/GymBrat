"use client";

import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/utils";

export type HomeComplianceSlot = "tak" | "nie" | null;

function ComplianceRing({
  label,
  count,
  pct,
  tone,
}: {
  label: string;
  count: number | null;
  pct: number | null;
  tone: string;
}) {
  const value = pct ?? 0;
  const r = 34;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, value)) / 100) * c;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex h-[88px] w-[88px] items-center justify-center">
        <svg viewBox="0 0 88 88" className="absolute inset-0 h-full w-full" aria-hidden>
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="7"
          />
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke={tone}
            strokeWidth="7"
            strokeDasharray={`${dash} ${c}`}
            strokeLinecap="round"
            transform="rotate(-90 44 44)"
            className="transition-[stroke-dasharray] duration-700 ease-out"
          />
        </svg>
        <div className="relative z-[1] text-center leading-none">
          {count == null ? (
            <p className="font-metric text-[28px] text-white/35">—</p>
          ) : (
            <AnimatedMetric
              value={count}
              className="text-[28px] text-white"
            />
          )}
        </div>
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
        {label}
      </p>
    </div>
  );
}

function DotRow({
  label,
  slots,
}: {
  label: string;
  slots: HomeComplianceSlot[];
}) {
  return (
    <div className="flex items-center gap-2.5">
      <p className="w-[4.5rem] shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
        {label}
      </p>
      <div className="flex min-w-0 flex-1 items-end gap-[3px] overflow-hidden">
        {slots.length === 0 ? (
          <p className="text-[11px] text-white/30">Brak danych</p>
        ) : (
          slots.map((s, i) => (
            <span
              key={i}
              title={
                s === "tak"
                  ? "Zrealizowane"
                  : s === "nie"
                    ? "Opuszczone"
                    : "Brak wpisu"
              }
              className={cn(
                "h-7 w-[7px] shrink-0 rounded-full sm:w-2",
                s === "tak"
                  ? "bg-[#7ddea0]"
                  : s === "nie"
                    ? "bg-[#e07a6a]"
                    : "bg-white/12",
              )}
            />
          ))
        )}
      </div>
    </div>
  );
}

function countTak(slots: HomeComplianceSlot[]): number | null {
  if (slots.length === 0) return null;
  const known = slots.filter((s) => s === "tak" || s === "nie");
  if (known.length === 0) return null;
  return known.filter((s) => s === "tak").length;
}

export function HomeZalozeniaSection({
  dietPct,
  trainingPct,
  cardioPct,
  reportCount,
  dietHistory,
  trainingHistory,
  cardioHistory,
}: {
  dietPct: number | null;
  trainingPct: number | null;
  cardioPct: number | null;
  reportCount: number;
  dietHistory: HomeComplianceSlot[];
  trainingHistory: HomeComplianceSlot[];
  cardioHistory: HomeComplianceSlot[];
}) {
  return (
    <section className="space-y-3">
      <SectionLabel
        index={2}
        title="Założenia"
        trailing={
          reportCount > 0
            ? `${reportCount} ${
                reportCount === 1
                  ? "raport"
                  : reportCount >= 2 && reportCount <= 4
                    ? "raporty"
                    : "raportów"
              }`
            : "brak raportów"
        }
      />

      <div className="app-card space-y-5 p-5">
        <div className="grid grid-cols-3 gap-2">
          <ComplianceRing
            label="Dieta"
            count={countTak(dietHistory)}
            pct={dietPct}
            tone="#e8c547"
          />
          <ComplianceRing
            label="Treningi"
            count={countTak(trainingHistory)}
            pct={trainingPct}
            tone="#7ddea0"
          />
          <ComplianceRing
            label="Cardio"
            count={countTak(cardioHistory)}
            pct={cardioPct}
            tone="#6eb5ff"
          />
        </div>

        <div className="space-y-2.5">
          <DotRow label="Dieta" slots={dietHistory} />
          <DotRow label="Treningi" slots={trainingHistory} />
          <DotRow label="Cardio" slots={cardioHistory} />
        </div>
      </div>
    </section>
  );
}
