"use client";

import Link from "next/link";
import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PROFILE_SECTIONS } from "@/components/profile/profile-sections";
import { BackLink } from "@/components/ui/back-link";

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

/** @deprecated użyj ProfileTabs */
export function ProfileNav() {
  return <ProfileTabs />;
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
      <div role="radiogroup" aria-label={ariaLabel} className="space-y-2">
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
                <span className="mt-0.5 text-xs text-white/50">
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
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
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

/** Wiersz z przełącznikiem (cały wiersz klikalny, cel dotyku ≥ 56 px). */
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
  const id = useId();
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 py-2.5">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-[15px] font-semibold leading-snug text-white/90">
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block text-[13px] leading-snug text-white/50">
            {description}
          </span>
        ) : null}
      </label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

/** Pasek „wstecz” podstron profilu (ukryty na przeglądzie /profile). */
export function ProfileBackBar() {
  const pathname = usePathname();
  if (pathname === "/profile") return null;
  return (
    <BackLink href="/profile" label="Profil" />
  );
}
