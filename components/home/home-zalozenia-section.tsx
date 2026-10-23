"use client";

import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/utils";

export type HomeComplianceSlot = "tak" | "nie" | null;

function ComplianceRing({
  label,
  pct,
  tone,
}: {
  label: string;
  pct: number | null;
  tone: string;
}) {
  const value = pct ?? 0;
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, value)) / 100) * c;

  return (
    <div className="flex flex-col items-center gap-1.5 rounded-[18px] border border-white/[0.08] bg-white/[0.025] px-1 py-3">
      <div className="relative flex h-[68px] w-[68px] items-center justify-center">
        <svg viewBox="0 0 68 68" className="absolute inset-0 h-full w-full" aria-hidden>
          <circle
            cx="34"
            cy="34"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="5"
          />
          <circle
            cx="34"
            cy="34"
            r={r}
            fill="none"
            stroke={tone}
            strokeWidth="5"
            strokeDasharray={`${dash} ${c}`}
            strokeLinecap="round"
            transform="rotate(-90 34 34)"
            className="transition-[stroke-dasharray] duration-700 ease-out"
          />
        </svg>
        <div className="relative z-[1] flex items-baseline gap-0.5 leading-none">
          {pct == null ? (
            <p className="font-metric text-[22px] text-white/35">—</p>
          ) : (
            <>
              <AnimatedMetric value={Math.round(value)} className="text-[22px] text-white" />
              <span className="text-[10px] font-medium text-white/40">%</span>
            </>
          )}
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-white/65">
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: tone }}
        />
        {label}
      </p>
      <p
        className={cn(
          "rounded-full border px-2 py-0.5 text-[10px] font-medium",
          pct == null
            ? "border-white/[0.08] text-white/35"
            : pct >= 80
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
              : pct >= 50
                ? "border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10 text-[var(--gym-gold)]"
                : "border-rose-400/30 bg-rose-500/10 text-rose-300",
        )}
      >
        {pct == null
          ? "brak danych"
          : pct >= 80
            ? "świetnie"
            : pct >= 50
              ? "w normie"
              : "do poprawy"}
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
    <div className="flex items-center gap-2">
      <p className="w-14 shrink-0 text-[11px] font-medium text-white/45">{label}</p>
      <div className="flex min-w-0 flex-1 items-center gap-[2px] overflow-hidden">
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
                "h-4 w-[6px] shrink-0 rounded-full sm:w-[7px]",
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

function FormTile({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.03] px-1.5 py-2.5 text-center">
      <p className="truncate text-[11px] font-medium text-white/45">{label}</p>
      {value != null ? (
        <AnimatedMetric
          value={value}
          className="mt-1 text-[22px] leading-none text-white"
        />
      ) : (
        <p className="mt-1 font-metric text-[22px] leading-none text-white/35">—</p>
      )}
      <div className="mx-auto mt-2 h-1 w-[70%] overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={cn(
            "h-full rounded-full",
            value == null
              ? "bg-transparent"
              : value >= 8
                ? "bg-emerald-400"
                : value >= 5
                  ? "bg-[var(--gym-gold)]"
                  : "bg-rose-400",
          )}
          style={{ width: `${value == null ? 0 : Math.min(100, Math.max(0, value * 10))}%` }}
        />
      </div>
    </div>
  );
}

export function HomeZalozeniaSection({
  dietPct,
  trainingPct,
  cardioPct,
  reportCount,
  dietHistory,
  trainingHistory,
  cardioHistory,
  formToday,
}: {
  dietPct: number | null;
  trainingPct: number | null;
  cardioPct: number | null;
  reportCount: number;
  dietHistory: HomeComplianceSlot[];
  trainingHistory: HomeComplianceSlot[];
  cardioHistory: HomeComplianceSlot[];
  formToday: {
    energy: number | null;
    sleep: number | null;
    digestion: number | null;
    training: number | null;
  };
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

      <div className="app-card space-y-3.5 p-4">
        <div className="grid grid-cols-3 gap-2">
          <ComplianceRing label="Dieta" pct={dietPct} tone="#e8c547" />
          <ComplianceRing label="Treningi" pct={trainingPct} tone="#7ddea0" />
          <ComplianceRing label="Cardio" pct={cardioPct} tone="#6eb5ff" />
        </div>

        <div className="space-y-1.5 border-t border-white/[0.06] pt-3">
          <DotRow label="Dieta" slots={dietHistory} />
          <DotRow label="Treningi" slots={trainingHistory} />
          <DotRow label="Cardio" slots={cardioHistory} />
        </div>

        <div className="border-t border-white/[0.06] pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
            Forma z ostatniego raportu
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            <FormTile label="Energia" value={formToday.energy} />
            <FormTile label="Sen" value={formToday.sleep} />
            <FormTile label="Trawienie" value={formToday.digestion} />
            <FormTile label="Trening" value={formToday.training} />
          </div>
        </div>
      </div>
    </section>
  );
}
