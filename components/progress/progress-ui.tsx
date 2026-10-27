"use client";

import { useId, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown, Info, Minus } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { velocityTone } from "@/lib/analytics";
import { fmtPct } from "@/lib/progress-format";
import { cn } from "@/lib/utils";

/**
 * Wspólny język wizualny ekranów Postępy.
 * Jedna sekcja = jedna karta; kafelki, strzałki trendu i przełączniki
 * mają tu jedną implementację zamiast kopii w każdej zakładce.
 */

export type Tone = "up" | "down" | "flat" | "none";

export function toneText(tone: Tone): string {
  if (tone === "up") return "text-[var(--gym-success)]";
  return "text-[var(--gym-text-secondary)]";
}

export function ToneIcon({
  tone,
  className,
}: {
  tone: Tone;
  className?: string;
}) {
  const cls = cn("h-3.5 w-3.5 shrink-0", toneText(tone), className);
  if (tone === "up") return <ArrowUpRight className={cls} aria-hidden />;
  if (tone === "down") return <ArrowDownRight className={cls} aria-hidden />;
  return <Minus className={cls} aria-hidden />;
}

/** Procentowa zmiana ze strzałką i kolorem (próg ±3% jak w silniku analityki). */
export function PctValue({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  const tone = velocityTone(value);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-metric tabular-nums",
        toneText(tone),
        className,
      )}
    >
      <ToneIcon tone={tone} />
      {fmtPct(value)}
    </span>
  );
}

/** Sekcja: etykieta + treść. Bez numeracji (01/02/A/C mieszały się między zakładkami). */
export function ProgressSection({
  title,
  trailing,
  children,
  className,
}: {
  title: string;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <SectionLabel title={title} trailing={trailing} titleTone="white" titleAs="h2" />
      {children}
    </section>
  );
}

type SurfaceVariant = "panel" | "hero" | "list";

const SURFACE: Record<SurfaceVariant, string> = {
  panel: "app-panel px-3.5 py-3",
  hero: "relative overflow-hidden rounded-2xl border border-[var(--gym-gold)]/30 bg-gradient-to-b from-[rgba(var(--neon-rgb),0.14)] via-[var(--gym-surface-sunken)] to-[var(--gym-surface-sunken)] px-3.5 py-3.5",
  list: "app-panel divide-y divide-white/[0.06]",
};

export function Surface({
  variant = "panel",
  className,
  children,
}: {
  variant?: SurfaceVariant;
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn(SURFACE[variant], className)}>{children}</div>;
}

export function Eyebrow({
  children,
  gold,
  className,
}: {
  children: ReactNode;
  gold?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.14em]",
        gold ? "text-[var(--gym-gold)]" : "text-[var(--gym-text-secondary)]",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Mały kafelek metryki (etykieta, wartość, podpis) — opcjonalnie klikalny. */
export function StatTile({
  label,
  value,
  hint,
  valueClassName,
  onClick,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  valueClassName?: string;
  onClick?: () => void;
  className?: string;
}) {
  const body = (
    <>
      <Eyebrow>{label}</Eyebrow>
      <div
        className={cn(
          "mt-1.5 font-metric text-[1.35rem] leading-none tabular-nums text-white",
          valueClassName,
        )}
      >
        {value}
      </div>
      {hint ? (
        <p className="mt-1.5 text-[11px] leading-snug text-[var(--gym-text-secondary)]">{hint}</p>
      ) : null}
    </>
  );
  const base = "rounded-xl border border-white/10 bg-black/35 px-3 py-2.5";
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

/** Segmenty (zakładki, okresy). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
        className={cn(
        "flex gap-1 rounded-xl border border-white/10 bg-black/30 p-1",
        className,
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={cn(
              "min-h-11 min-w-0 flex-1 whitespace-nowrap rounded-lg px-1.5 py-2 text-[12px] font-semibold transition active:scale-[0.97]",
              active
                ? "bg-[var(--gym-gold)]/20 text-[var(--gym-gold)] shadow-[0_0_0_1px_rgba(var(--neon-rgb),0.35)]"
                : "text-[var(--gym-text-secondary)] hover:text-white/90",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Karta zwijana: nagłówek z jednozdaniowym podsumowaniem, szczegóły po otwarciu. */
export function CollapsibleCard({
  title,
  summary,
  icon,
  defaultOpen = false,
  lazy = false,
  children,
}: {
  title: string;
  summary?: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  lazy?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [mounted, setMounted] = useState(defaultOpen);
  const contentId = useId();
  return (
    <div className="app-panel overflow-hidden">
      <button
        type="button"
        onClick={() => {
          setMounted(true);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
      >
        {icon ? (
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--neon-rgb),0.12)] text-[var(--gym-gold)]">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold leading-snug text-white">
            {title}
          </span>
          {summary ? (
            <span className="mt-0.5 block truncate text-[11px] leading-snug text-white/45">
              {summary}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-white/40 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {(!lazy || mounted) ? (
        <div id={contentId} hidden={!open} className="border-t border-white/[0.06]">
          {children}
        </div>
      ) : <div id={contentId} hidden className="border-t border-white/[0.06]" />}
    </div>
  );
}

/** Objaśnienia metodologii schowane pod „i” — zamiast stopek pod każdą kartą. */
export function Explainer({
  children,
  label = "Jak to liczymy",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <details className="text-[11px] leading-snug text-[var(--gym-text-secondary)]">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-[var(--gym-text-secondary)] select-none [&::-webkit-details-marker]:hidden">
        <Info className="h-3 w-3" aria-hidden />
        {label}
      </summary>
      <div className="mt-1.5 space-y-1">{children}</div>
    </details>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="app-panel px-3.5 py-4 text-center text-[13px] leading-snug text-white/45">
      {children}
    </div>
  );
}

/** Poziomy pasek (miernik, udział). */
export function Meter({
  pct,
  className,
  barClassName,
}: {
  pct: number;
  className?: string;
  barClassName?: string;
}) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-white/[0.08]", className)}>
      <div
        className={cn(
          "h-full rounded-full bg-[var(--gym-gold)] transition-[width] duration-300 motion-reduce:transition-none",
          barClassName,
        )}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}
