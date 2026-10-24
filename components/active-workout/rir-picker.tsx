import { cn } from "@/lib/utils";

const RIR_OPTIONS = [0, 1, 2, 3] as const;

/**
 * RIR 0 / 1 / 2 / 3+ (BR-9): podświetlony `value` (seria albo cel planu);
 * bez celu i bez wyboru nic nie jest podświetlone.
 */
export function RirPicker({
  value,
  targetRir,
  onChange,
}: {
  value: number | null;
  targetRir: number | null;
  onChange: (rir: number) => void;
}) {
  const goal = targetRir != null ? `cel ${targetRir}` : "opcjonalnie";
  return (
    <div role="group" aria-labelledby="rir-picker-label">
      <p
        id="rir-picker-label"
        className="text-[13px] font-semibold text-white/75"
      >
        RIR
        <span className="font-normal text-[var(--gym-text-secondary)]">
          <span className="compact:hidden"> · powtórzenia w zapasie · {goal}</span>
          <span className="hidden compact:inline"> · w zapasie · {goal}</span>
        </span>
      </p>
      <div className="mt-2 grid grid-cols-4 gap-2 compact:mt-1.5 compact:gap-1.5">
        {RIR_OPTIONS.map((v) => {
          const active = value != null && (value === v || (v === 3 && value >= 3));
          return (
            <button
              key={v}
              type="button"
              aria-pressed={active}
              aria-label={
                v === 3
                  ? "RIR 3 lub więcej, powtórzenia w zapasie"
                  : `RIR ${v}, powtórzenia w zapasie`
              }
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange(v)}
              className={cn(
                "h-12 rounded-[14px] text-[16px] font-bold tabular-nums transition motion-safe:active:scale-[0.97] compact:h-11",
                active
                  ? "gym-btn-primary"
                  : "border border-[var(--gym-border-gold)] bg-[var(--gym-black)] text-white/80 hover:border-[var(--gym-gold)]/40",
              )}
            >
              {v === 3 ? "3+" : v}
            </button>
          );
        })}
      </div>
    </div>
  );
}
