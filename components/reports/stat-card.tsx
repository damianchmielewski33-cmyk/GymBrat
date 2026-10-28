import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  className?: string;
};

/** Kafelek metryki raportów — kanon `app-card` + Bebas KPI. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
}: StatCardProps) {
  return (
    <div className={cn("app-card relative overflow-hidden p-4", className)}>
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="app-label">{label}</p>
          <p className="font-metric mt-2 text-[length:var(--text-kpi)] leading-none tabular-nums tracking-tight text-white sm:text-2xl">
            {value}
          </p>
          {hint ? (
            <p className="mt-1.5 text-[length:var(--text-caption)] text-white/55">
              {hint}
            </p>
          ) : null}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10">
          <Icon className="h-5 w-5 text-[var(--gym-gold)]" aria-hidden />
        </div>
      </div>
    </div>
  );
}
