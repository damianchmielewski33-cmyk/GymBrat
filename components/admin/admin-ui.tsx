"use client";

import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Wspólne klocki wizualne panelu admina — jeden język dla wszystkich ekranów. */

export type AdminTone = "neutral" | "ok" | "warn" | "danger" | "info" | "gold";

const TONE_PILL: Record<AdminTone, string> = {
  neutral: "border-white/12 bg-white/[0.05] text-white/65",
  ok: "border-emerald-400/30 bg-emerald-500/12 text-emerald-200",
  warn: "border-amber-400/30 bg-amber-500/12 text-amber-200",
  danger: "border-rose-400/35 bg-rose-500/12 text-rose-200",
  info: "border-sky-400/30 bg-sky-500/12 text-sky-200",
  gold: "border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/12 text-[var(--gym-gold)]",
};

export function AdminPageHeader({
  title,
  description,
  icon,
  actions,
  backHref,
  backLabel = "Wróć",
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="space-y-3">
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-white/50 transition-colors hover:text-white/85"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          {backLabel}
        </Link>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <span
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10 text-[var(--gym-gold)] [&_svg]:h-5 [&_svg]:w-5"
              aria-hidden
            >
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-semibold leading-tight text-white sm:text-2xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 max-w-2xl break-words text-sm leading-relaxed text-white/55">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

export function AdminCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  flush = false,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Treść bez wewnętrznego odstępu (np. tabela na całą szerokość karty). */
  flush?: boolean;
}) {
  return (
    <section
      className={cn("app-card-raised min-w-0 max-w-full border border-white/10", className)}
    >
      {title || actions ? (
        <header
          className={cn(
            "flex min-w-0 flex-col gap-2 px-3.5 pt-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:pt-5",
            flush && "border-b border-white/10 pb-4",
          )}
        >
          <div className="min-w-0">
            {title ? (
              <h2 className="font-heading text-base font-semibold text-white">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 break-words text-xs leading-relaxed text-white/50">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex min-w-0 flex-wrap gap-2">{actions}</div>
          ) : null}
        </header>
      ) : null}
      <div
        className={cn(
          flush ? "" : "p-3.5 sm:p-5",
          title && !flush && "pt-3 sm:pt-4",
          "min-w-0",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function AdminStat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: AdminTone;
}) {
  const valueTone =
    tone === "ok"
      ? "text-emerald-200"
      : tone === "warn"
        ? "text-amber-200"
        : tone === "danger"
          ? "text-rose-200"
          : tone === "gold"
            ? "text-[var(--gym-gold)]"
            : "text-white";
  return (
    <div className="app-panel border border-white/10 p-4">
      <p className="app-label">{label}</p>
      <p
        className={cn(
          "font-metric mt-1.5 text-[length:var(--text-kpi)] leading-none tabular-nums sm:text-2xl",
          valueTone,
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-[length:var(--text-caption)] text-white/55">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function AdminPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: AdminTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5",
        TONE_PILL[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function AdminNotice({
  tone = "info",
  children,
  className,
  action,
}: {
  tone?: Exclude<AdminTone, "neutral" | "gold">;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  const styles =
    tone === "danger"
      ? "border-rose-500/35 bg-rose-500/10 text-rose-100"
      : tone === "warn"
        ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
        : tone === "ok"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
          : "border-white/12 bg-white/[0.04] text-white/75";
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm leading-relaxed sm:flex-row sm:items-center sm:justify-between",
        styles,
        className,
      )}
    >
      <div className="min-w-0">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function AdminEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon ? (
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/40 [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </span>
      ) : null}
      <p className="text-sm font-medium text-white/80">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs leading-relaxed text-white/45">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function AdminLoading({ label = "Ładowanie…" }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-white/50"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

/** Pole formularza: etykieta nad kontrolką + opcjonalna podpowiedź. */
export function AdminField({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-white/65">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[11px] leading-snug text-white/40">{hint}</p> : null}
    </div>
  );
}

/** Natywny select w stylu `Input` (spójna wysokość i focus). */
export function AdminSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-white/20 bg-black/50 px-3 text-base text-white outline-none transition-colors focus-visible:border-[var(--neon)]/55 focus-visible:ring-[3px] focus-visible:ring-ring/80 disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}
