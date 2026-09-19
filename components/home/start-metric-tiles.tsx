import { Activity, ArrowUpDown, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  className,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Scale;
  className?: string;
  accent?: "neon" | "steel" | "ember";
}) {
  const glow =
    accent === "neon"
      ? "opacity-40 [background-image:radial-gradient(420px_200px_at_0%_0%,rgba(255,45,85,0.22),transparent_62%)]"
      : accent === "ember"
        ? "opacity-35 [background-image:radial-gradient(380px_180px_at_100%_0%,rgba(255,160,60,0.16),transparent_60%)]"
        : "opacity-30 [background-image:radial-gradient(360px_160px_at_50%_0%,rgba(255,255,255,0.08),transparent_65%)]";

  return (
    <div
      className={cn(
        "glass-panel relative flex min-h-[7.5rem] flex-col overflow-hidden p-3.5 sm:min-h-[8.25rem] sm:p-4",
        className,
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0", glow)} />
      <div className="relative flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">
            {label}
          </p>
          <Icon className="h-3.5 w-3.5 shrink-0 text-white/35" aria-hidden />
        </div>
        <p className="font-heading mt-auto pt-3 text-2xl font-semibold tabular-nums text-white sm:text-3xl">
          {value}
        </p>
        {hint ? <p className="mt-1 text-[11px] text-white/45">{hint}</p> : null}
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
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      <MetricTile
        className="col-span-2"
        accent="neon"
        icon={Scale}
        label="Waga"
        value={weightKg != null ? `${weightKg} kg` : "—"}
        hint="Ostatni pomiar"
      />
      <MetricTile
        accent="steel"
        icon={Activity}
        label="Tempo"
        value={tempoKgPerMin != null ? `${tempoKgPerMin}` : "—"}
        hint="kg / min sesji"
      />
      <MetricTile
        accent="ember"
        icon={ArrowUpDown}
        label="Od startu"
        value={formatSignedKg(weightFromStartKg)}
        hint="Od pierwszego ważenia"
      />
    </section>
  );
}
