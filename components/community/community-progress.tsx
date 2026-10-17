import { cn } from "@/lib/utils";

/** Progress bar w stylu Fitness/Whoop — a11y + gold fill. */
export function CommunityProgress({
  value,
  label,
  className,
  tone = "gold",
}: {
  /** 0–100 */
  value: number;
  label: string;
  className?: string;
  tone?: "gold" | "mint";
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={cn("h-2.5 overflow-hidden rounded-full bg-white/10", className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          tone === "mint" ? "bg-emerald-400" : "bg-[var(--gym-gold)]",
          "shadow-[0_0_12px_rgba(var(--neon-rgb),0.35)]",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
