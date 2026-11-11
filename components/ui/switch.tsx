"use client";

import { cn } from "@/lib/utils";

/**
 * Przełącznik on/off w standardzie iOS/Material: tor 48×28, uchwyt 24 px,
 * cel dotyku ≥ 44 px (wysokość wiersza zapewnia rodzic). role="switch".
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none",
        checked ? "bg-[var(--gym-gold)]" : "bg-white/20",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none block h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.5)] transition-transform duration-200 ease-out motion-reduce:transition-none",
          checked ? "translate-x-5 bg-[#16130b]" : "translate-x-0",
        )}
      />
    </button>
  );
}
