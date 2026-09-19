function DimensionTile({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="glass-panel p-4 sm:p-5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
        {label}
      </p>
      <p className="font-heading mt-2 text-xl font-semibold tabular-nums text-white sm:text-2xl">
        {value}
        <span className="ml-1 text-sm font-medium text-white/45">{unit}</span>
      </p>
    </div>
  );
}

function fmt(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(Math.round(n * 10) / 10);
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
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      <DimensionTile label="Waga" value={fmt(weightKg)} unit="kg" />
      <DimensionTile label="Pas" value={fmt(waistCm)} unit="cm" />
      <DimensionTile label="Ramię" value={fmt(armCm)} unit="cm" />
      <DimensionTile label="Brzuch" value={fmt(abdomenCm)} unit="cm" />
    </section>
  );
}
