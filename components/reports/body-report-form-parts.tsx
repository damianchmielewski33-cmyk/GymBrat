"use client";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import Image from "next/image";
import { ArrowLeft, Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { WebcamCaptureDialog, canUseWebcamCapture } from "@/components/ui/webcam-capture-dialog";
import { TOTAL_STEPS } from "@/components/reports/body-report-form-utils";

export function GoldButton({
  children,
  className,
  disabled,
  type = "button",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "gold-btn inline-flex h-12 min-w-[7.5rem] items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold tracking-wide",
        "disabled:pointer-events-none disabled:opacity-45",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121214]",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostBackButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "gym-btn-outline inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold",
        "disabled:opacity-40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50",
      )}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Wstecz
    </button>
  );
}

export function ProgressSegments({ step }: { step: number }) {
  return (
    <div className="mt-4 flex gap-1.5" aria-hidden>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors",
            i < step ? "bg-[var(--gym-gold)]" : "bg-white/12",
          )}
        />
      ))}
    </div>
  );
}

export function StepBadge({
  icon,
  step,
  title,
  subtitle,
}: {
  icon: ReactNode;
  step: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mt-5 flex gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--gym-gold)]/40 bg-[var(--gym-gold)]/12 text-[var(--gym-gold)]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
          Krok {step} z {TOTAL_STEPS}
        </p>
        <h3 className="font-heading text-xl font-semibold text-white">{title}</h3>
        <p className="mt-0.5 text-sm text-white/50">{subtitle}</p>
      </div>
    </div>
  );
}

export function FieldLabel({
  children,
  required,
  htmlFor,
  id,
}: {
  children: ReactNode;
  required?: boolean;
  /** Powiązanie z polem — czytnik ekranu odczytuje etykietę przy fokusie. */
  htmlFor?: string;
  id?: string;
}) {
  const className =
    "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gym-gold)]/90";
  const content = (
    <>
      {children}
      {required ? <span className="text-[var(--gym-gold)]">, wymagane</span> : null}
    </>
  );
  return htmlFor ? (
    <label id={id} htmlFor={htmlFor} className={className}>
      {content}
    </label>
  ) : (
    <p id={id} className={className}>
      {content}
    </p>
  );
}

export function MeasureInput({
  id,
  label,
  value,
  onChange,
  required,
  large,
  invalid,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  large?: boolean;
  invalid?: boolean;
  /** Podpowiedź z ostatniego raportu (placeholder w tle). */
  hint?: string;
}) {
  return (
    <div>
      <FieldLabel required={required} htmlFor={id}>
        {label}
      </FieldLabel>
      <input
        id={id}
        inputMode="decimal"
        aria-required={required || undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hint ?? "—"}
        aria-invalid={invalid || undefined}
        className={cn(
          "w-full rounded-xl border bg-black/50 px-3 text-white outline-none focus-ring transition placeholder:text-white/50",
          "focus-visible:border-[var(--gym-gold)]/55 focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/25",
          large ? "h-14 text-2xl font-semibold tabular-nums" : "h-12 text-lg tabular-nums",
          invalid ? "border-state-error/55" : "border-[var(--gym-gold)]/22",
        )}
      />
      {hint && !value.trim() ? (
        <p id={`${id}-hint`} className="mt-1 text-[10px] text-white/50">
          Ostatnio: {hint}
        </p>
      ) : null}
    </div>
  );
}

export function ScoreBars({
  label,
  value,
  onChange,
  invalid,
  hint,
  readOnly,
  lowLabel = "bardzo słabo",
  highLabel = "bardzo dobrze",
}: {
  /** Opisy końców skali 1–10 (czytnik ekranu + widoczny podpis). */
  lowLabel?: string;
  highLabel?: string;
  label: string;
  value: number | null;
  onChange?: (v: number) => void;
  invalid?: boolean;
  hint?: number | null;
  readOnly?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p
          id={`score-${label}`}
          className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.16em]",
            invalid ? "text-state-error" : "text-white/55",
          )}
        >
          {label}
        </p>
        {value != null ? (
          <p className="text-[11px] font-semibold tabular-nums text-[var(--gym-gold)]">
            {value}/10
          </p>
        ) : hint != null && !readOnly ? (
          <p className="text-[10px] text-white/50">ostatnio {hint}</p>
        ) : null}
      </div>
      <div
        className="flex h-10 items-end gap-1"
        role={readOnly ? "img" : "radiogroup"}
        aria-label={
          readOnly
            ? `${label}: ${value ?? "brak"}${value != null ? " z 10" : ""}`
            : `${label}, skala 1–10: 1 to ${lowLabel}, 10 to ${highLabel}`
        }
        aria-required={readOnly ? undefined : true}
        aria-invalid={!readOnly && invalid ? true : undefined}
      >
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          const active = value != null && n <= value;
          const ghost = value == null && hint != null && n <= hint;
          if (readOnly) {
            return (
              <div
                key={n}
                className={cn(
                  "h-full min-w-0 flex-1 rounded-full",
                  active
                    ? "bg-gradient-to-t from-[var(--gym-gold-deep)] to-[var(--gym-gold)] shadow-[0_0_10px_rgba(212,175,55,0.35)]"
                    : "border border-white/12 bg-transparent",
                )}
              />
            );
          }
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} z 10`}
              onClick={() => onChange?.(n)}
              className={cn(
                "h-full min-w-0 flex-1 rounded-full transition",
                active
                  ? "bg-gradient-to-t from-[var(--gym-gold-deep)] to-[var(--gym-gold)] shadow-[0_0_10px_rgba(212,175,55,0.35)]"
                  : ghost
                    ? "border border-[var(--gym-gold)]/25 bg-[var(--gym-gold)]/10"
                    : "border border-white/18 bg-transparent hover:border-white/35",
              )}
            />
          );
        })}
      </div>
      {readOnly ? null : (
        <div className="mt-1 flex justify-between text-[10px] text-white/50" aria-hidden>
          <span>1 – {lowLabel}</span>
          <span>10 – {highLabel}</span>
        </div>
      )}
    </div>
  );
}

export function TakNieToggle({
  label,
  value,
  onChange,
  invalid,
  hint,
  readOnly,
}: {
  label: string;
  value: "" | "tak" | "nie";
  onChange?: (v: "tak" | "nie") => void;
  invalid?: boolean;
  hint?: string | null;
  readOnly?: boolean;
}) {
  const hintLabel =
    hint === "tak" || hint === "nie" ? `ostatnio: ${hint}` : null;
  if (readOnly) {
    const tone =
      value === "tak"
        ? "bg-[#7ddea0] text-black"
        : value === "nie"
          ? "bg-[#e07a6a] text-black"
          : "border border-white/15 bg-white/[0.04] text-white/50";
    return (
      <div className="min-w-0 flex-1">
        <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
          {label}
        </p>
        <div
          className={cn(
            "flex h-11 items-center justify-center rounded-xl text-sm font-semibold uppercase tracking-wide",
            tone,
          )}
        >
          {value === "tak" ? "Tak" : value === "nie" ? "Nie" : "—"}
        </div>
      </div>
    );
  }
  return (
    <div className="min-w-0 flex-1">
      <p
        className={cn(
          "mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em]",
          invalid ? "text-state-error" : "text-white/50",
        )}
      >
        {label}
      </p>
      {hintLabel && !value ? (
        <p className="mb-1.5 text-center text-[9px] text-white/50">{hintLabel}</p>
      ) : (
        <p className="mb-1.5 h-[14px]" aria-hidden />
      )}
      <div
        className="grid grid-cols-2 gap-1.5"
        role="radiogroup"
        aria-label={label}
        aria-required="true"
        aria-invalid={invalid || undefined}
      >
        <button
          type="button"
          role="radio"
          aria-checked={value === "tak"}
          onClick={() => onChange?.("tak")}
          className={cn(
            "h-11 rounded-xl text-sm font-semibold uppercase tracking-wide transition",
            value === "tak"
              ? "bg-[#7ddea0] text-black"
              : hint === "tak" && !value
                ? "border border-[#7ddea0]/40 bg-[#7ddea0]/10 text-white/70"
                : "border border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/[0.07]",
          )}
        >
          Tak
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={value === "nie"}
          onClick={() => onChange?.("nie")}
          className={cn(
            "h-11 rounded-xl text-sm font-semibold uppercase tracking-wide transition",
            value === "nie"
              ? "bg-[#e07a6a] text-black"
              : hint === "nie" && !value
                ? "border border-[#e07a6a]/40 bg-[#e07a6a]/10 text-white/70"
                : "border border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/[0.07]",
          )}
        >
          Nie
        </button>
      </div>
    </div>
  );
}

export function PhotoSlotCard({
  label,
  src,
  disabled,
  onPick,
  onClear,
}: {
  label: string;
  src: string | null;
  disabled?: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [webcamOpen, setWebcamOpen] = useState(false);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onPick(file);
  };

  return (
    <div className="relative min-h-[9.5rem] overflow-hidden rounded-2xl border border-[var(--gym-gold)]/25 bg-black/45">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={onChange}
      />
      {src ? (
        <>
          <Image
            src={src}
            alt={label}
            fill
            unoptimized
            className="object-cover"
            sizes="120px"
          />
          <button
            type="button"
            onClick={onClear}
            className="absolute right-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-1 text-white/85"
            aria-label={`Usuń zdjęcie ${label}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <p className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-bold tracking-[0.16em] text-[var(--gym-gold)]">
            {label}
          </p>
        </>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => (canUseWebcamCapture() ? setWebcamOpen(true) : inputRef.current?.click())}
          className="gold-btn flex h-full min-h-[9.5rem] w-full flex-col items-center justify-center gap-2 rounded-none px-2 py-4 text-center disabled:opacity-50"
        >
          <Camera className="h-6 w-6" aria-hidden />
          <span className="text-[11px] font-bold tracking-[0.16em]">{label}</span>
          <span className="h-px w-10 bg-black/20" aria-hidden />
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-black/55">
            Lub z galerii
          </span>
        </button>
      )}
      <WebcamCaptureDialog
        open={webcamOpen}
        onClose={() => setWebcamOpen(false)}
        onCapture={(file) => {
          setWebcamOpen(false);
          onPick(file);
        }}
        onPickFile={() => {
          setWebcamOpen(false);
          inputRef.current?.click();
        }}
      />
    </div>
  );
}
