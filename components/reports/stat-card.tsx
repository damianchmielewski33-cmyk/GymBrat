import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
};

export function StatCard({ label, value, hint, icon: Icon }: StatCardProps) {
  return (
    <div className="glass-panel neon-glow relative overflow-hidden p-5">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(420px_200px_at_0%_0%,rgba(255,45,85,0.18),transparent_55%)]" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
            {label}
          </p>
          <p className="font-heading mt-2 text-2xl font-semibold tabular-nums tracking-tight text-white">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-xs text-white/50">{hint}</p>
          ) : null}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--neon)]/35 bg-[var(--neon)]/10">
          <Icon className="h-5 w-5 text-[var(--neon)]" />
        </div>
      </div>
    </div>
  );
}
