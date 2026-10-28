"use client";

import { ChevronDown } from "lucide-react";
import { CARDIO_INPUT_LIMITS, type CardioFieldKey } from "@/lib/cardio-utils";
import { cn } from "@/lib/utils";

type FieldErrors = Partial<Record<CardioFieldKey, string>>;

type Props = {
  open: boolean;
  onToggle: () => void;
  distanceKm: string;
  avgHr: string;
  maxHr: string;
  calories: string;
  steps: string;
  effortScore: number | null;
  note: string;
  onChange: (patch: {
    distanceKm?: string;
    avgHr?: string;
    maxHr?: string;
    calories?: string;
    steps?: string;
    effortScore?: number | null;
    note?: string;
  }) => void;
  onBlurField: (field: CardioFieldKey) => void;
  fieldErrors: FieldErrors;
  disabled?: boolean;
};

const fieldClass =
  "h-12 w-full rounded-xl border border-white/12 bg-[var(--gym-surface-raised)] px-3 pr-12 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-[var(--gym-gold)]/45 focus:ring-2 focus:ring-[var(--gym-gold)]/20";

const fieldErrorClass = "border-[var(--destructive)] focus:border-[var(--destructive)]";

function filledCount(p: {
  distanceKm: string;
  avgHr: string;
  maxHr: string;
  calories: string;
  steps: string;
  effortScore: number | null;
  note: string;
}): number {
  let n = 0;
  if (p.distanceKm.trim()) n += 1;
  if (p.avgHr.trim()) n += 1;
  if (p.maxHr.trim()) n += 1;
  if (p.calories.trim()) n += 1;
  if (p.steps.trim()) n += 1;
  if (p.effortScore != null) n += 1;
  if (p.note.trim()) n += 1;
  return n;
}

export function CardioLogDetailsSection({
  open,
  onToggle,
  distanceKm,
  avgHr,
  maxHr,
  calories,
  steps,
  effortScore,
  note,
  onChange,
  onBlurField,
  fieldErrors,
  disabled,
}: Props) {
  const filled = filledCount({
    distanceKm,
    avgHr,
    maxHr,
    calories,
    steps,
    effortScore,
    note,
  });
  const panelId = "cardio-details-panel";

  return (
    <div className="rounded-2xl border border-white/[0.08]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        onClick={onToggle}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-[14px] font-semibold text-white">
            Szczegóły · opcjonalne
          </span>
          <span className="mt-0.5 block text-[12px] text-[var(--gym-text-secondary)]">
            {filled} z 7 wypełnione
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-[var(--gym-text-secondary)] transition",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={panelId}
          className="space-y-3 border-t border-white/[0.06] px-4 pb-4 pt-3"
        >
          <UnitField
            label="Dystans"
            unit="km"
            value={distanceKm}
            inputMode="decimal"
            placeholder="np. 3,5"
            error={fieldErrors.distanceKm}
            errorId="err-distanceKm"
            disabled={disabled}
            onChange={(v) => onChange({ distanceKm: v })}
            onBlur={() => onBlurField("distanceKm")}
          />
          <div className="grid grid-cols-2 gap-3">
            <UnitField
              label="Śr. tętno"
              unit="bpm"
              value={avgHr}
              inputMode="numeric"
              placeholder="np. 125"
              error={fieldErrors.avgHr}
              errorId="err-avgHr"
              disabled={disabled}
              onChange={(v) => onChange({ avgHr: v })}
              onBlur={() => onBlurField("avgHr")}
            />
            <UnitField
              label="Maks. tętno"
              unit="bpm"
              value={maxHr}
              inputMode="numeric"
              placeholder="np. 165"
              error={fieldErrors.maxHr}
              errorId="err-maxHr"
              disabled={disabled}
              onChange={(v) => onChange({ maxHr: v })}
              onBlur={() => onBlurField("maxHr")}
            />
          </div>

          <div>
            <p className="app-label">Wysiłek (1–10)</p>
            <div
              role="radiogroup"
              aria-label="Wysiłek w skali 1 do 10"
              className="mt-1.5 grid grid-cols-5 gap-2"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const checked = effortScore === n;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    disabled={disabled}
                    aria-checked={checked}
                    onClick={() =>
                      onChange({ effortScore: checked ? null : n })
                    }
                    className={cn(
                      "inline-flex h-11 items-center justify-center rounded-xl border text-[13px] font-semibold tabular-nums",
                      checked
                        ? "border-[rgba(235,196,74,0.55)] bg-[rgba(235,196,74,0.12)] text-[var(--gym-gold)]"
                        : "border-white/10 text-white/75",
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            {fieldErrors.effortScore ? (
              <p className="mt-1 text-[12px] text-[#ff8593]" role="alert">
                {fieldErrors.effortScore}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <UnitField
              label="Kalorie"
              unit="kcal"
              value={calories}
              inputMode="numeric"
              placeholder="np. 280"
              error={fieldErrors.calories}
              errorId="err-calories"
              disabled={disabled}
              onChange={(v) => onChange({ calories: v })}
              onBlur={() => onBlurField("calories")}
            />
            <UnitField
              label="Kroki"
              unit="kroków"
              value={steps}
              inputMode="numeric"
              placeholder="np. 4500"
              error={fieldErrors.steps}
              errorId="err-steps"
              disabled={disabled}
              onChange={(v) => onChange({ steps: v })}
              onBlur={() => onBlurField("steps")}
            />
          </div>

          <label className="block">
            <span className="app-label">Notatka</span>
            <textarea
              value={note}
              disabled={disabled}
              maxLength={CARDIO_INPUT_LIMITS.notesMax}
              rows={2}
              placeholder="np. pod górkę, 6% nachylenia"
              aria-invalid={fieldErrors.notes != null}
              aria-describedby={fieldErrors.notes ? "err-notes" : undefined}
              onChange={(e) => onChange({ note: e.target.value })}
              onBlur={() => onBlurField("notes")}
              className={cn(
                "mt-1.5 w-full resize-none rounded-xl border border-white/12 bg-[var(--gym-surface-raised)] px-3 py-3 text-sm text-white outline-none placeholder:text-white/30",
                "focus:border-[var(--gym-gold)]/45 focus:ring-2 focus:ring-[var(--gym-gold)]/20",
                fieldErrors.notes && fieldErrorClass,
              )}
            />
            <span className="mt-1 flex justify-between text-[11px] text-[var(--gym-text-secondary)]">
              {fieldErrors.notes ? (
                <span id="err-notes" role="alert" className="text-[#ff8593]">
                  {fieldErrors.notes}
                </span>
              ) : (
                <span />
              )}
              {note.length >= 240 ? (
                <span className="tabular-nums">
                  {note.length}/{CARDIO_INPUT_LIMITS.notesMax}
                </span>
              ) : null}
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}

function UnitField({
  label,
  unit,
  value,
  inputMode,
  placeholder,
  error,
  errorId,
  disabled,
  onChange,
  onBlur,
}: {
  label: string;
  unit: string;
  value: string;
  inputMode: "decimal" | "numeric";
  placeholder: string;
  error?: string;
  errorId: string;
  disabled?: boolean;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <label className="block">
      <span className="app-label">{label}</span>
      <span className="relative mt-1.5 block">
        <input
          value={value}
          inputMode={inputMode}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error != null}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={cn(fieldClass, error && fieldErrorClass)}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] text-[var(--gym-text-secondary)]">
          {unit}
        </span>
      </span>
      {error ? (
        <span id={errorId} role="alert" className="mt-1 block text-[12px] text-[#ff8593]">
          {error}
        </span>
      ) : null}
    </label>
  );
}
