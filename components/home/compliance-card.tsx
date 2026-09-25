function Ring({
  label,
  pct,
}: {
  label: string;
  pct: number | null;
}) {
  const value = pct ?? 0;
  const r = 28;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 72 72" className="h-16 w-16" aria-hidden>
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="4"
        />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="var(--neon)"
          strokeWidth="4"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
        <text
          x="36"
          y="40"
          textAnchor="middle"
          fill="var(--neon)"
          fontSize="16"
          fontWeight="600"
        >
          {pct == null ? "—" : value}
        </text>
      </svg>
      <p className="app-label">{label}</p>
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
    <section className="app-card p-5">
      <div className="flex items-center justify-between">
        <p className="app-label">Trzymanie się założeń</p>
        <p className="text-[10px] uppercase tracking-wider text-white/35">
          {lastN} raportów
        </p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Ring label="Dieta" pct={dietPct} />
        <Ring label="Treningi" pct={trainingPct} />
        <Ring label="Cardio" pct={cardioPct} />
      </div>
    </section>
  );
}
