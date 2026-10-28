"use client";

import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Calculator, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Wspólne klocki ekranu Profil: sekcja (karta) → bloki (podsekcje) → pola.
 * Wszystkie formularze w profilu używają tych samych odstępów, etykiet i przycisków.
 */

export const PROFILE_SECTIONS = [
  { id: "body", label: "Ciało", href: "/profile/body" },
  { id: "training", label: "Trening", href: "/profile/training" },
  { id: "diet", label: "Dieta", href: "/profile/diet" },
  { id: "reminders", label: "Przypomnienia", href: "/profile/reminders" },
  { id: "app", label: "Aplikacja", href: "/profile/app" },
  { id: "account", label: "Konto", href: "/profile/account" },
] as const;

export type ProfileSectionId = (typeof PROFILE_SECTIONS)[number]["id"];

/** Zakładki podstron profilu — prawdziwe trasy (ADR 0006 / UX U-5). */
export function ProfileTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sekcje profilu"
      className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-5 sm:px-5 [&::-webkit-scrollbar]:hidden"
    >
      <Link
        href="/profile"
        aria-current={pathname === "/profile" ? "page" : undefined}
        className={cn(
          "shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50",
          pathname === "/profile"
            ? "border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]"
            : "border-white/10 bg-white/[0.04] text-white/65 hover:border-[var(--gym-gold)]/40 hover:text-[var(--gym-gold)]",
        )}
      >
        Przegląd
      </Link>
      {PROFILE_SECTIONS.map((s) => {
        const active =
          pathname === s.href || pathname.startsWith(`${s.href}/`);
        return (
          <Link
            key={s.id}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50",
              active
                ? "border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]"
                : "border-white/10 bg-white/[0.04] text-white/65 hover:border-[var(--gym-gold)]/40 hover:text-[var(--gym-gold)]",
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** @deprecated użyj ProfileTabs — kotwice na jednej stronie. */
export function ProfileNav() {
  return <ProfileTabs />;
}

export function ProfileSection({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id?: ProfileSectionId | string;
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="app-card scroll-mt-24 p-5 sm:p-6">
      <header className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10 text-[var(--gym-gold)]"
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight text-white">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-[13px] leading-relaxed text-white/45">
              {description}
            </p>
          ) : null}
        </div>
      </header>
      <div className="mt-5 divide-y divide-white/[0.07] [&>*]:py-5 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
        {children}
      </div>
    </section>
  );
}

export function ProfileBlock({
  title,
  description,
  action,
  children,
  tone = "default",
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3
            className={cn(
              "text-[15px] font-semibold leading-snug",
              tone === "danger" ? "text-rose-200" : "text-white",
            )}
          >
            {title}
          </h3>
          {description ? (
            <p className="mt-1 text-[13px] leading-relaxed text-white/45">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

/** Pole formularza: etykieta, kontrolka i podpowiedź w jednym miejscu. */
export function ProfileField({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-[13px] font-medium text-white/75"
      >
        {label}
      </label>
      {children}
      {hint ? (
        <p className="text-xs leading-snug text-white/40">{hint}</p>
      ) : null}
    </div>
  );
}

/** Wartość wyliczona — nie wygląda jak pole edytowalne (ADR 0006 §6). */
export function ProfileComputedValue({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-3.5 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/40">
        <Calculator className="h-3.5 w-3.5" aria-hidden />
        <span>{label}</span>
        <span className="normal-case tracking-normal text-white/30">
          · wyliczone
        </span>
      </div>
      <p className="mt-1.5 text-sm font-semibold tabular-nums text-white/90">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs leading-snug text-white/40">{hint}</p>
      ) : null}
    </div>
  );
}

/** Stan systemowy — chip/badge, nie switch (ADR 0006 §6). */
export function ProfileSystemState({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2",
        className,
      )}
    >
      <Lock className="h-3.5 w-3.5 shrink-0 text-white/35" aria-hidden />
      <span className="text-[11px] text-white/40">{label}</span>
      <span className="truncate text-[13px] font-medium text-white/80">
        {value}
      </span>
    </div>
  );
}

/** Grupa chipów / radiogroup z aria-pressed (ADR 0006 §7). */
export function ProfileChipGroup({
  options,
  value,
  onChange,
  name,
  variant = "chips",
  "aria-label": ariaLabel,
}: {
  options: Array<{ value: string; label: string; description?: string }>;
  value: string | null | undefined;
  onChange: (next: string) => void;
  name?: string;
  variant?: "chips" | "list";
  "aria-label"?: string;
}) {
  if (variant === "list") {
    return (
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className="space-y-2"
      >
        {options.map((o) => {
          const selected = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              name={name}
              onClick={() => onChange(o.value)}
              className={cn(
                "flex min-h-14 w-full flex-col items-start justify-center rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50",
                selected
                  ? "border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/12"
                  : "border-white/10 bg-black/25 hover:bg-white/[0.04]",
              )}
            >
              <span className="text-sm font-semibold text-white/90">
                {o.label}
              </span>
              {o.description ? (
                <span className="mt-0.5 text-xs text-white/45">
                  {o.description}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-2"
    >
      {options.map((o) => {
        const pressed = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50",
              pressed
                ? "border-[var(--gym-gold)]/55 bg-[var(--gym-gold)]/20 text-[var(--gym-gold)]"
                : "border-white/12 bg-white/[0.04] text-white/70 hover:border-white/25",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Natywny select w wyglądzie `Input`. */
export function ProfileSelect({
  className,
  ...props
}: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 min-h-11 w-full rounded-lg border border-white/20 bg-black/50 px-3 text-base text-white outline-none transition-colors focus-visible:border-[var(--neon)]/55 focus-visible:ring-[3px] focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708] disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

/** Przełącznik on/off (role=switch). */
export function ProfileSwitch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50 disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white/90">
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-snug text-white/45">
            {description}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
          checked
            ? "border-[var(--gym-gold)]/60 bg-[var(--gym-gold)]/40"
            : "border-white/15 bg-white/10",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left]",
            checked ? "left-[1.375rem]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

/** Mały kafelek „etykieta + wartość”. */
export function ProfileStat({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.08] bg-black/25 px-3.5 py-3">
      <p className="app-label">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-white/90">{value}</p>
    </div>
  );
}

/** Karta stanu na przeglądzie `/profile`. */
export function ProfileOverviewCard({
  href,
  title,
  summary,
  cta,
}: {
  href: string;
  title: string;
  summary: ReactNode;
  cta?: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-[var(--gym-gold)]/35 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-white">{title}</p>
          <div className="mt-1.5 text-[13px] leading-relaxed text-white/55">
            {summary}
          </div>
        </div>
        <span className="shrink-0 text-[12px] font-medium text-[var(--gym-gold)]">
          {cta ?? "Otwórz"}
        </span>
      </div>
    </Link>
  );
}
