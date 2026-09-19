import { Activity, ArrowUpDown, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  className,
  accent,
  dense,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Scale;
  className?: string;
  accent?: "neon" | "steel" | "ember";
  dense?: boolean;
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
        "glass-panel relative flex flex-col overflow-hidden",
        dense ? "min-h-[4.75rem] p-3" : "min-h-[6.5rem] p-3.5 sm:min-h-[7.25rem] sm:p-4",
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
        <p
          className={cn(
            "font-heading mt-auto font-semibold tabular-nums text-white",
            dense ? "pt-1.5 text-xl sm:text-2xl" : "pt-2 text-2xl sm:text-3xl",
          )}
        >
          {value}
        </p>
        {hint ? <p className="mt-0.5 text-[11px] text-white/45">{hint}</p> : null}
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
  stacked = false,
}: {
  weightKg: number | null;
  tempoKgPerMin: number | null;
  weightFromStartKg: number | null;
  /** Na xl: kolumna obok treningu zamiast rzędu 2+1+1 */
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <section className="grid h-full grid-cols-2 gap-2 xl:grid-cols-1 xl:gap-2.5">
        <MetricTile
          className="col-span-2 xl:col-span-1 xl:flex-1"
          accent="neon"
          icon={Scale}
          label="Waga"
          value={weightKg != null ? `${weightKg} kg` : "—"}
          hint="Ostatni pomiar"
        />
        <MetricTile
          dense
          accent="steel"
          icon={Activity}
          label="Tempo"
          value={tempoKgPerMin != null ? `${tempoKgPerMin}` : "—"}
          hint="kg / min sesji"
        />
        <MetricTile
          dense
          accent="ember"
          icon={ArrowUpDown}
          label="Od startu"
          value={formatSignedKg(weightFromStartKg)}
          hint="Od pierwszego ważenia"
        />
      </section>
    );
  }

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
