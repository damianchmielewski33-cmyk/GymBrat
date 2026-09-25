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
  const r = 28;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/12 bg-[#222226] px-2 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.35)]">
      <svg viewBox="0 0 72 72" className="h-16 w-16" aria-hidden>
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="5"
        />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="5"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
        <text
          x="36"
          y="40"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="15"
          fontWeight="600"
        >
          {pct == null ? "—" : value}
        </text>
      </svg>
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">
        {label}
      </p>
    </div>
  );
}

export function ComplianceCard({
  dietPct,
  trainingPct,
  cardioPct,
  lastN,
}: {
  dietPct: number | null;
  trainingPct: number | null;
  cardioPct: number | null;
  lastN: number;
  doneN: number;
}) {
  return (
    <section className="rounded-[22px] border border-white/[0.1] bg-[#121214] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
            Trzymanie się założeń
          </p>
          <p className="mt-1 text-xs text-white/40">
            Średnia z ostatnich raportów
          </p>
        </div>
        <p className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/45">
          {lastN} raportów
        </p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Ring label="Dieta" pct={dietPct} tone="#5eead4" />
        <Ring label="Treningi" pct={trainingPct} tone="#d4af37" />
        <Ring label="Cardio" pct={cardioPct} tone="#86efac" />
      </div>
    </section>
  );
}
