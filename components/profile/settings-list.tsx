import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Grupa wierszy ustawień (jak w iOS/Android): nagłówek + zaokrąglona lista. */
export function SettingsGroup({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      {title ? (
        <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/55">
          {title}
        </h2>
      ) : null}
      <div className="divide-y divide-white/[0.07] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        {children}
      </div>
    </section>
  );
}

/** Wiersz-link: ikona, tytuł, podsumowanie wartości i szewron. */
export function SettingsRow({
  href,
  icon: Icon,
  title,
  value,
  tone = "default",
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  value?: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--gym-gold)]/50"
    >
      <span
        aria-hidden
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
          tone === "danger"
            ? "border-state-error/30 bg-state-error/10 text-state-error"
            : "border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10 text-[var(--gym-gold)]",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-snug text-white">
          {title}
        </span>
        {value ? (
          <span className="mt-0.5 block truncate text-[13px] leading-snug text-white/50">
            {value}
          </span>
        ) : null}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-white/55" aria-hidden />
    </Link>
  );
}
