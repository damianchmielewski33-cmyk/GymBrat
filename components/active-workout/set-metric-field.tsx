import type { ReactNode, Ref } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const stepperClass =
  "inline-flex h-[52px] w-16 shrink-0 items-center justify-center rounded-2xl border border-[var(--gym-border-gold)] bg-[var(--gym-black)] text-white transition hover:border-[var(--gym-gold)]/40 motion-safe:active:scale-[0.96] compact:h-11 compact:w-14";

/**
 * Karta pola liczbowego serii (ciężar, powtórzenia): etykieta, wartość w polu,
 * steppery −/+ i slot po prawej w nagłówku (szybkie przyciski albo znacznik celu).
 * Komunikat walidacji zastępuje slot, więc układ nie skacze.
 */
export function SetMetricField({
  id,
  label,
  labelMeta,
  value,
  onValueChange,
  onBlur,
  inputMode,
  step,
  max,
  unit,
  accent = false,
  headerSlot,
  error,
  onDecrement,
  onIncrement,
  decrementLabel,
  incrementLabel,
  inputRef,
}: {
  id: string;
  label: string;
  labelMeta?: string;
  value: string;
  onValueChange: (raw: string) => void;
  onBlur: () => void;
  inputMode: "decimal" | "numeric";
  step: number;
  max: number;
  unit?: string;
  /** Złota wartość (ciężar). */
  accent?: boolean;
  headerSlot?: ReactNode;
  /** Tekst komunikatu walidacji; null = brak błędu. */
  error: string | null;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementLabel: string;
  incrementLabel: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const errorId = `${id}-error`;
  return (
    <div
      className={cn(
        "rounded-[18px] border bg-[var(--gym-surface-gold)] px-4 py-3 compact:px-3.5 compact:py-2",
        error
          ? "border-[var(--destructive)]"
          : "border-[var(--gym-border-gold)] border-t-[var(--gym-gold)]/22",
      )}
    >
      <div className="flex h-6 items-center justify-between gap-2 compact:h-5">
        <label htmlFor={id} className="text-[13px] font-semibold text-white/75">
          {label}
          {labelMeta ? (
            <span className="font-normal text-[var(--gym-text-secondary)]"> {labelMeta}</span>
          ) : null}
        </label>
        <p
          id={errorId}
          role="alert"
          className={cn(
            "items-center gap-1.5 text-[13px] font-semibold text-white",
            error ? "flex" : "sr-only",
          )}
        >
          {error ? (
            <>
              <span aria-hidden className="size-2 rounded-full bg-[var(--destructive)]" />
              {error}
            </>
          ) : null}
        </p>
        {error ? null : headerSlot}
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-end gap-1">
          <input
            ref={inputRef}
            id={id}
            type="number"
            inputMode={inputMode}
            step={step}
            min={0}
            max={max}
            value={value}
            placeholder="0"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => onValueChange(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={onBlur}
            className={cn(
              "h-14 min-w-0 flex-1 bg-transparent px-0 text-left font-metric text-[50px] leading-[56px] tabular-nums tracking-tight outline-none placeholder:text-white/30 compact:h-11 compact:text-[40px] compact:leading-[44px]",
              accent ? "text-[var(--gym-gold)]" : "text-white",
            )}
          />
          {unit ? (
            <span className="mb-2.5 shrink-0 text-[14px] font-semibold text-[var(--gym-gold)]/85 compact:mb-1.5">
              {unit}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            aria-label={decrementLabel}
            onClick={onDecrement}
            className={stepperClass}
          >
            <Minus className="size-5" />
          </button>
          <button
            type="button"
            aria-label={incrementLabel}
            onClick={onIncrement}
            className={stepperClass}
          >
            <Plus className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
