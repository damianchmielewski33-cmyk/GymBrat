"use client";

import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: string };

/**
 * Przełącznik 2–3 opcji ze złotym, ruchomym wskaźnikiem (cele dotykowe ≥ 44 px).
 * Ruch wyłączany przez prefers-reduced-motion (`motion-reduce:transition-none`).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const n = options.length;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "relative flex gap-[3px] rounded-xl border border-white/20 bg-black/50 p-[3px]",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[3px] top-[3px] left-[3px] rounded-lg bg-gradient-to-b from-[#f6e3a1] via-[var(--gym-gold)] to-[var(--gym-gold-deep)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition-transform duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none"
        style={{
          width: `calc((100% - 6px - ${(n - 1) * 3}px) / ${n})`,
          transform: `translateX(calc(${index} * (100% + 3px)))`,
        }}
      />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 min-h-11 flex-1 rounded-lg text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none",
              on ? "text-[var(--neon-fg)]" : "text-white/60 hover:text-white",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
