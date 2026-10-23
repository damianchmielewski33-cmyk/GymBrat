import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Wspólne klocki ekranu Profil: sekcja (karta) → bloki (podsekcje) → pola.
 * Wszystkie formularze w profilu używają tych samych odstępów, etykiet i przycisków.
 */

export const PROFILE_SECTIONS = [
  { id: "body", label: "Ciało" },
  { id: "training", label: "Trening" },
  { id: "diet", label: "Dieta" },
  { id: "reminders", label: "Przypomnienia" },
  { id: "app", label: "Aplikacja" },
  { id: "account", label: "Konto" },
] as const;

export type ProfileSectionId = (typeof PROFILE_SECTIONS)[number]["id"];

/** Pasek skrótów do sekcji — zwykłe kotwice, więc działa bez JS. */
export function ProfileNav() {
  return (
    <nav
      aria-label="Sekcje profilu"
      className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-5 sm:px-5 [&::-webkit-scrollbar]:hidden"
    >
      {PROFILE_SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[13px] font-medium text-white/65 transition-colors hover:border-[var(--gym-gold)]/40 hover:text-[var(--gym-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50"
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

export function ProfileSection({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id: ProfileSectionId;
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
          <h2 className="text-lg font-semibold leading-tight text-white">{title}</h2>
          {description ? (
            <p className="mt-1 text-[13px] leading-relaxed text-white/45">{description}</p>
          ) : null}
        </div>
      </header>
      {/* Bloki oddziela cienka linia; puste (null) bloki nie zostawiają odstępów. */}
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
            <p className="mt-1 text-[13px] leading-relaxed text-white/45">{description}</p>
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
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-white/75">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs leading-snug text-white/40">{hint}</p> : null}
    </div>
  );
}

/** Natywny select w wyglądzie `Input` (jedna wysokość i focus w całym profilu). */
export function ProfileSelect({ className, ...props }: ComponentProps<"select">) {
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

/** Przełącznik on/off (role=switch) — zamiast gołych checkboxów. */
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
        <span className="block text-sm font-semibold text-white/90">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-snug text-white/45">{description}</span>
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

/** Mały kafelek „etykieta + wartość” (np. e-mail w nagłówku). */
export function ProfileStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.08] bg-black/25 px-3.5 py-3">
      <p className="app-label">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-white/90">{value}</p>
    </div>
  );
}
