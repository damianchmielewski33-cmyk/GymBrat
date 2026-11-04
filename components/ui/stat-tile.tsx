import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE: Record<"default" | "gold" | "mint" | "muted", string> = {
  default: "text-white",
  gold: "text-[var(--gym-gold)]",
  mint: "text-[var(--gym-success)]",
  muted: "text-white/70",
};

export type StatTileProps = {
  label: string;
  value: ReactNode;
  /** Podpis pod wartością (tylko układ `stacked`). */
  hint?: ReactNode;
  /** Ikona w prawym górnym rogu (tylko układ `stacked`). */
  icon?: LucideIcon;
  tone?: keyof typeof TONE;
  /**
   * `centered` — wartość nad etykietą, wyśrodkowane (Pulpit / drużyna).
   * `stacked` — etykieta nad wartością, podpis i ikona opcjonalne (Analiza, raporty, Społeczność).
   */
  layout?: "centered" | "stacked";
  /** `card` = `app-card`, `panel` = `app-panel` z ramką, `inset` = wpuszczony (zagnieżdżony w karcie). */
  surface?: "card" | "panel" | "inset";
  valueClassName?: string;
  onClick?: () => void;
  className?: string;
};

const SURFACE = {
  card: "app-card",
  panel: "app-panel border border-white/10",
  inset: "rounded-xl border border-white/[0.06] bg-black/30",
} as const;

/**
 * Z67: jedyny kafel statystyki w aplikacji. Pozostałe nazwy (`AppStatTile`, `StatTile`
 * w Analizie, `StatCard` raportów) to cienkie nakładki na ten komponent.
 */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  layout = "stacked",
  surface = layout === "centered" ? "card" : "panel",
  valueClassName,
  onClick,
  className,
}: StatTileProps) {
  const centered = layout === "centered";
  const valueEl = (
    <p
      className={cn(
        "font-metric text-[length:var(--text-kpi)] leading-none tabular-nums",
        centered ? "sm:text-[26px]" : "mt-1.5",
        TONE[tone],
        valueClassName,
      )}
    >
      {value}
    </p>
  );
  const labelEl = (
    <p className={cn("app-label", centered && "mt-1.5")}>{label}</p>
  );
  const body = centered ? (
    <>
      {valueEl}
      {labelEl}
    </>
  ) : (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {labelEl}
        {valueEl}
        {hint ? (
          <p className="mt-1.5 text-[length:var(--text-label)] leading-snug text-[var(--gym-text-secondary)]">
            {hint}
          </p>
        ) : null}
      </div>
      {Icon ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10">
          <Icon className="h-5 w-5 text-[var(--gym-gold)]" aria-hidden />
        </div>
      ) : null}
    </div>
  );
  const base = cn(
    SURFACE[surface],
    centered ? "px-3 py-3 text-center" : surface === "inset" ? "px-3 py-2.5" : "px-3 py-2.5",
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          base,
          "block w-full text-left transition active:scale-[0.98] hover:border-white/20",
          className,
        )}
      >
        {body}
      </button>
    );
  }
  return <div className={cn(base, className)}>{body}</div>;
}
