"use client";

import { cn } from "@/lib/utils";

export type ComplianceSlot = "tak" | "nie" | null;

function Ring({
  label,
  pct,
  tone,
}: {
  label: string;
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
          <p className="font-display text-[28px] tabular-nums text-white">
            {pct == null ? "—" : value}
          </p>
          {pct != null ? (
            <p className="mt-0.5 text-[11px] font-medium text-white/45">%</p>
          ) : null}
        </div>
      </div>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
        {label}
      </p>
    </div>
  );
}

function CapsuleRow({
  label,
  slots,
}: {
  label: string;
  slots: ComplianceSlot[];
}) {
  return (
    <div className="flex items-center gap-2.5">
      <p className="w-[4.75rem] shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
        {label}
      </p>
      <div className="flex min-w-0 flex-1 items-end gap-[3px] overflow-hidden">
        {slots.length === 0 ? (
          <p className="text-[11px] text-white/30">Brak danych</p>
        ) : (
          slots.map((s, i) => (
            <span
              key={i}
              title={s === "tak" ? "Zrealizowane" : s === "nie" ? "Opuszczone" : "Brak wpisu"}
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

export function ComplianceCard({
  dietPct,
  trainingPct,
  cardioPct,
  lastN,
  historyWindow,
  dietHistory,
  trainingHistory,
  cardioHistory,
}: {
  dietPct: number | null;
  trainingPct: number | null;
  cardioPct: number | null;
  lastN: number;
  doneN?: number;
  historyWindow: number;
  dietHistory: ComplianceSlot[];
  trainingHistory: ComplianceSlot[];
  cardioHistory: ComplianceSlot[];
}) {
  const shown = Math.min(historyWindow, lastN);

  return (
    <section className="rounded-[22px] border border-white/[0.08] bg-[#141416] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
          Trzymanie się założeń
        </p>
        <p className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
          {lastN} raportów
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Ring label="Dieta" pct={dietPct} tone="#e8c547" />
        <Ring label="Treningi" pct={trainingPct} tone="#7ddea0" />
        <Ring label="Cardio" pct={cardioPct} tone="#6eb5ff" />
      </div>

      <div className="mt-5 space-y-2.5">
        <CapsuleRow label="Dieta" slots={dietHistory} />
        <CapsuleRow label="Treningi" slots={trainingHistory} />
        <CapsuleRow label="Cardio" slots={cardioHistory} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white/45">
            <span className="h-2 w-2 rounded-full bg-[#7ddea0]" aria-hidden />
            Zrealizowane
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white/45">
            <span className="h-2 w-2 rounded-full bg-[#e07a6a]" aria-hidden />
            Opuszczone
          </span>
        </div>
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">
          Ostatnie {shown} z {lastN || 0}
        </p>
      </div>
    </section>
  );
}
