import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Calculator, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfileSectionId } from "@/components/profile/profile-sections";

export {
  PROFILE_SECTIONS,
  type ProfileSectionId,
} from "@/components/profile/profile-sections";

/**
 * Wspólne klocki ekranu Profil (Server Components OK).
 * Interaktywne: ProfileTabs / ProfileSwitch / ProfileChipGroup → profile-client.tsx
 */

export {
  ProfileTabs,
  ProfileNav,
  ProfileChipGroup,
  ProfileSwitch,
} from "@/components/profile/profile-client";

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
          <h2 className="font-heading text-lg font-semibold leading-tight text-white">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-[length:var(--text-body-sm)] leading-relaxed text-white/55">
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
