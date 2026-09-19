function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="glass-panel relative overflow-hidden p-4 sm:p-5">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(500px_240px_at_0%_0%,rgba(255,45,85,0.10),transparent_60%)]" />
      <div className="relative">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
          {label}
        </p>
        <p className="font-heading mt-2 text-2xl font-semibold tabular-nums text-white">
          {value}
        </p>
        {hint ? <p className="mt-1 text-xs text-white/45">{hint}</p> : null}
      </div>
    </div>
  );
}

function formatSignedKg(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded} kg`;
}

export function StartMetricTiles({
  weightKg,
  tempoKgPerMin,
  weightFromStartKg,
}: {
  weightKg: number | null;
  tempoKgPerMin: number | null;
  weightFromStartKg: number | null;
}) {
  return (
    <section className="grid grid-cols-3 gap-2 sm:gap-3">
      <MetricTile
        label="Waga"
        value={weightKg != null ? `${weightKg} kg` : "—"}
        hint="Ostatni pomiar"
      />
      <MetricTile
        label="Tempo"
        value={tempoKgPerMin != null ? `${tempoKgPerMin}` : "—"}
        hint="kg / min ostatniej sesji"
      />
      <MetricTile
        label="Waga od startu"
        value={formatSignedKg(weightFromStartKg)}
        hint="Od pierwszego ważenia"
      />
    </section>
  );
}
