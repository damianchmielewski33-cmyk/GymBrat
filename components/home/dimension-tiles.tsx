function fmt(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(Math.round(n * 10) / 10);
}

function DimensionCell({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 sm:px-3.5 sm:py-3.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
        {label}
      </p>
      <p className="font-heading mt-1.5 text-xl font-semibold tabular-nums text-white sm:text-2xl">
        {value}
        <span className="ml-1 text-sm font-medium text-white/45">{unit}</span>
      </p>
    </div>
  );
}

export function DimensionTiles({
  weightKg,
  waistCm,
  armCm,
  abdomenCm,
}: {
  weightKg: number | null;
  waistCm: number | null;
  armCm: number | null;
  abdomenCm: number | null;
}) {
  return (
    <section className="glass-panel relative overflow-hidden p-3.5 sm:p-4">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(120deg,rgba(255,45,85,0.10),transparent_50%)]" />
      <div className="relative">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
              Sylwetka
            </p>
            <h2 className="font-heading mt-1 text-base font-semibold text-white sm:text-lg">
              Aktualne wymiary
            </h2>
          </div>
          <p className="hidden text-xs text-white/40 sm:block">
            Z ostatniego raportu
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
          <DimensionCell label="Waga" value={fmt(weightKg)} unit="kg" />
          <DimensionCell label="Pas" value={fmt(waistCm)} unit="cm" />
          <DimensionCell label="Ramię" value={fmt(armCm)} unit="cm" />
          <DimensionCell label="Brzuch" value={fmt(abdomenCm)} unit="cm" />
        </div>
      </div>
    </section>
  );
}
