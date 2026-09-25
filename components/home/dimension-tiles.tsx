import { MiniSparkline } from "@/components/home/mini-sparkline";
import type { HomeStartSpark } from "@/lib/home-start";
import { cn } from "@/lib/utils";

const TILES = [
  {
    key: "waist",
    label: "PAS",
    color: "#4ade80",
    /** Niższa wartość = lepszy wynik → zielona strzałka w dół przy spadku */
    lowerIsBetter: true,
  },
  {
    key: "thigh",
    label: "UDO",
    color: "#60a5fa",
    lowerIsBetter: true,
  },
  {
    key: "chest",
    label: "KLATKA",
    color: "#c9a84a",
    lowerIsBetter: false,
  },
  {
    key: "arm",
    label: "RAMIĘ",
    color: "#f472b6",
    lowerIsBetter: false,
  },
] as const;

function fmtCm(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const r = Math.round(n * 10) / 10;
  return String(r).replace(".", ",");
}

function fmtDelta(n: number): string {
  const r = Math.round(Math.abs(n) * 10) / 10;
  return String(r).replace(".", ",");
}

function DimensionTile({
  label,
  value,
  unit,
  spark,
  color,
  lowerIsBetter,
}: {
  label: string;
  value: number | null;
  unit: string;
  spark: HomeStartSpark[];
  color: string;
  lowerIsBetter: boolean;
}) {
  const values = spark.map((s) => s.value);
  const start = values.length ? values[0]! : null;
  const current = value ?? (values.length ? values[values.length - 1]! : null);
  const count = values.length;

  let delta: number | null = null;
  if (start != null && current != null && Number.isFinite(start) && Number.isFinite(current)) {
    delta = Math.round((current - start) * 10) / 10;
  }

  const showDelta = delta != null && Math.abs(delta) >= 0.05;
  const decreased = delta != null && delta < 0;
  const improved = delta != null && (lowerIsBetter ? decreased : !decreased && delta !== 0);
  const deltaColor = improved
    ? "text-emerald-400"
    : decreased
      ? "text-rose-400"
      : "text-white/55";

  return (
    <div className="flex min-h-[168px] flex-col overflow-hidden rounded-[18px] bg-[#161616] px-3.5 pb-3 pt-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90">
          {label}
        </p>
        {showDelta ? (
          <p
            className={cn(
              "flex items-center gap-0.5 text-[11px] font-semibold tabular-nums",
              deltaColor,
            )}
          >
            <span aria-hidden className="text-[9px] leading-none">
              {decreased ? "▼" : "▲"}
            </span>
            {fmtDelta(delta!)}
          </p>
        ) : null}
      </div>

      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-[42px] leading-none tracking-wide text-white">
          {fmtCm(current)}
        </span>
        <span className="text-[13px] font-medium text-white/55">{unit}</span>
      </p>

      <div className="mt-2 min-h-0 flex-1">
        <MiniSparkline values={values} color={color} className="h-14 w-full" />
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-white/40">
        <span>start {fmtCm(start)}</span>
        <span>
          {count} {count === 1 ? "pomiar" : count >= 2 && count <= 4 ? "pomiary" : "pomiarów"}
        </span>
      </div>
    </div>
  );
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
  const byKey = {
    waist: { value: waistCm, spark: waistSpark },
    thigh: { value: thighCm, spark: thighSpark },
    chest: { value: chestCm, spark: chestSpark },
    arm: { value: armCm, spark: armSpark },
  } as const;

  return (
    <section className="grid grid-cols-2 gap-2.5">
      {TILES.map((tile) => (
        <DimensionTile
          key={tile.key}
          label={tile.label}
          value={byKey[tile.key].value}
          unit="cm"
          spark={byKey[tile.key].spark}
          color={tile.color}
          lowerIsBetter={tile.lowerIsBetter}
        />
      ))}
    </section>
  );
}
