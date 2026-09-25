import { MiniSparkline } from "@/components/home/mini-sparkline";
import type { HomeStartSpark } from "@/lib/home-start";

function DimensionTile({
  label,
  value,
  unit,
  spark,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  spark: number[];
  color: string;
}) {
  return (
    <div className="app-card p-4">
      <p className="app-label">{label}</p>
      <p className="mt-2 text-[28px] font-semibold leading-none text-white">
        {value}
        <span className="ml-1 text-sm font-medium text-white/40">{unit}</span>
      </p>
      <div className="mt-3">
        <MiniSparkline values={spark} color={color} />
      </div>
    </div>
  );
}

function fmt(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(Math.round(n * 10) / 10);
}

export function DimensionTiles({
  waistCm,
  armCm,
  chestCm,
  thighCm,
  waistSpark,
  thighSpark,
  chestSpark,
  armSpark,
}: {
  weightKg: number | null;
  waistCm: number | null;
  armCm: number | null;
  abdomenCm: number | null;
  chestCm: number | null;
  thighCm: number | null;
  waistSpark: HomeStartSpark[];
  thighSpark: HomeStartSpark[];
  chestSpark: HomeStartSpark[];
  armSpark: HomeStartSpark[];
}) {
  return (
    <section className="grid grid-cols-2 gap-2">
      <DimensionTile
        label="Pas"
        value={fmt(waistCm)}
        unit="cm"
        spark={waistSpark.map((s) => s.value)}
        color="#86efac"
      />
      <DimensionTile
        label="Udo"
        value={fmt(thighCm)}
        unit="cm"
        spark={thighSpark.map((s) => s.value)}
        color="#93c5fd"
      />
      <DimensionTile
        label="Klatka"
        value={fmt(chestCm)}
        unit="cm"
        spark={chestSpark.map((s) => s.value)}
        color="#d4af37"
      />
      <DimensionTile
        label="Ramię"
        value={fmt(armCm)}
        unit="cm"
        spark={armSpark.map((s) => s.value)}
        color="#f9a8d4"
      />
    </section>
  );
}
