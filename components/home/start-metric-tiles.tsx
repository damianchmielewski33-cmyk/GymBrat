import {
  Activity,
  CalendarDays,
  ClipboardList,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatKg(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

function formatSignedKg(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${String(rounded).replace(".", ",")}`;
}

function MetricTile({
  label,
  value,
  unit,
  hint,
  hintTone = "muted",
  Icon,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  hintTone?: "muted" | "gold" | "good" | "bad";
  Icon: LucideIcon;
}) {
  return (
    <div className="flex min-h-[118px] flex-col rounded-[18px] bg-[#161616] px-3.5 py-3.5">
      <div className="flex items-center gap-2">
        <Icon
          className="h-[18px] w-[18px] shrink-0 text-[var(--gym-gold)]"
          strokeWidth={1.75}
          aria-hidden
        />
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
          {label}
        </p>
      </div>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-[34px] leading-none tracking-wide text-white">
          {value}
        </span>
        {unit ? (
          <span className="text-[13px] font-medium text-white/50">{unit}</span>
        ) : null}
      </p>
      {hint ? (
        <p
          className={cn(
            "mt-auto pt-2 text-[11px] leading-snug",
            hintTone === "gold" && "text-[var(--gym-gold)]/85",
            hintTone === "good" && "text-emerald-400",
            hintTone === "bad" && "text-rose-400",
            hintTone === "muted" && "text-white/40",
          )}
        >
          {hint}
        </p>
      ) : (
        <div className="mt-auto pt-2" />
      )}
    </div>
  );
}

export function StartMetricTiles({
  weightKg,
  tempoKgPerMin,
  weightFromStartKg,
  weightDeltaFromPreviousKg,
  daysInProgram,
  reportCount,
}: {
  weightKg: number | null;
  tempoKgPerMin: number | null;
  weightFromStartKg: number | null;
  weightDeltaFromPreviousKg?: number | null;
  daysInProgram: number | null;
  reportCount: number;
}) {
  const weeks =
    daysInProgram != null
      ? Math.max(1, Math.round(daysInProgram / 7))
      : null;

  let weightHint: string | undefined;
  let weightTone: "muted" | "good" | "bad" = "muted";
  if (
    weightDeltaFromPreviousKg != null &&
    Number.isFinite(weightDeltaFromPreviousKg) &&
    Math.abs(weightDeltaFromPreviousKg) >= 0.05
  ) {
    const abs = formatKg(Math.abs(weightDeltaFromPreviousKg));
    const down = weightDeltaFromPreviousKg < 0;
    weightHint = `${down ? "↓" : "↑"} ${abs} kg od raportu`;
    weightTone = down ? "good" : "bad";
  } else if (weightFromStartKg != null && Number.isFinite(weightFromStartKg)) {
    weightHint = `${formatSignedKg(weightFromStartKg)} kg od startu`;
    weightTone = "muted";
  } else if (weightKg != null) {
    weightHint = "ostatni pomiar";
  }

  return (
    <section className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <MetricTile
          Icon={Scale}
          label="Waga"
          value={weightKg != null ? formatKg(weightKg) : "—"}
          unit="kg"
          hint={weightHint}
          hintTone={weightTone}
        />
        <MetricTile
          Icon={Activity}
          label="Tempo"
          value={tempoKgPerMin != null ? formatKg(tempoKgPerMin) : "—"}
          unit="kg/tydz"
          hint={weeks != null ? `śr. z ${weeks} tyg.` : "z ostatniej sesji"}
          hintTone="muted"
        />
        <MetricTile
          Icon={CalendarDays}
          label="W programie"
          value={daysInProgram != null ? String(daysInProgram) : "—"}
          unit={daysInProgram != null ? "dni" : undefined}
          hint={
            weeks != null
              ? `${weeks} tygodni · od pierwszego raportu`
              : "dodaj raport"
          }
          hintTone="gold"
        />
        <MetricTile
          Icon={ClipboardList}
          label="Raporty"
          value={String(reportCount)}
          hint="złożone"
          hintTone="muted"
        />
      </div>
    </section>
  );
}
