function MetricTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: string;
}) {
  return (
    <div className="app-card p-4">
      <p className="app-label">
        {icon ? <span className="mr-1">{icon}</span> : null}
        {label}
      </p>
      <p className="app-value mt-3 text-[28px] font-semibold leading-none">{value}</p>
      {hint ? <p className="mt-2 text-xs text-white/40">{hint}</p> : null}
    </div>
  );
}

function formatSignedKg(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}`;
}

export function StartMetricTiles({
  weightKg,
  tempoKgPerMin,
  weightFromStartKg,
  daysInProgram,
  reportCount,
}: {
  weightKg: number | null;
  tempoKgPerMin: number | null;
  weightFromStartKg: number | null;
  daysInProgram: number | null;
  reportCount: number;
}) {
  return (
    <section className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <MetricTile
          icon="⚖"
          label="Waga"
          value={weightKg != null ? `${weightKg}` : "—"}
          hint={weightKg != null ? "kg · ostatni pomiar" : undefined}
        />
        <MetricTile
          icon="↗"
          label="Od startu"
          value={formatSignedKg(weightFromStartKg)}
          hint="kg od pierwszego ważenia"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MetricTile
          icon="↯"
          label="Tempo"
          value={tempoKgPerMin != null ? `${tempoKgPerMin}` : "—"}
          hint="kg / tydz. z ostatniej sesji"
        />
        <MetricTile
          icon="▣"
          label="W programie"
          value={daysInProgram != null ? String(daysInProgram) : "—"}
          hint={
            daysInProgram != null
              ? `${Math.max(1, Math.round(daysInProgram / 7))} tygodni`
              : undefined
          }
        />
      </div>
      <MetricTile
        icon="◎"
        label="Raporty"
        value={String(reportCount)}
        hint="złożone"
      />
    </section>
  );
}
