"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Jedyny wzorzec komunikatów / potwierdzeń w aplikacji.
 * Zawsze karta na środku ekranu (nie arkusz dolny). Treść zawsze wyśrodkowana:
 * ikona → tytuł → opis → (opcjonalnie) treść → przyciski jeden pod drugim.
 */
export type AppDialogTone = "danger" | "gold" | "neutral";

const TONE: Record<AppDialogTone, { glow: string; badge: string }> = {
  danger: {
    glow: "rgba(244,63,94,0.20)",
    badge: "border-rose-400/35 bg-rose-500/12 text-rose-300",
  },
  gold: {
    glow: "rgba(221,187,109,0.20)",
    badge: "border-[var(--gym-gold)]/40 bg-[var(--gym-gold)]/12 text-[var(--gym-gold)]",
  },
  neutral: {
    glow: "rgba(255,255,255,0.07)",
    badge: "border-white/15 bg-white/[0.06] text-white/80",
  },
};

export function AppDialog({
  open,
  onOpenChange,
  tone = "neutral",
  icon: Icon,
  iconClassName,
  title,
  description,
  children,
  role,
  initialFocus,
  overlayClassName,
  className,
  autoCloseMs,
}: {
  /** Pokazuje pasek odliczający do automatycznego zamknięcia (zamykanie robi wywołujący). */
  autoCloseMs?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tone?: AppDialogTone;
  icon?: LucideIcon;
  iconClassName?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Treść dodatkowa i `AppDialogActions`. */
  children?: React.ReactNode;
  role?: "alertdialog" | "dialog";
  initialFocus?: React.RefObject<HTMLElement | null>;
  overlayClassName?: string;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        role={role}
        initialFocus={initialFocus}
        overlayClassName={overlayClassName}
        className={cn(
          "app-dialog overflow-hidden p-0 text-white",
          // zawsze na środku ekranu
          "w-[min(92vw,400px)] rounded-[28px]",
          className,
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(520px 200px at 50% -10%, ${t.glow}, transparent 65%)`,
          }}
        />
        <div className="relative flex flex-col items-center px-5 pb-5 pt-7 text-center sm:px-6 sm:pb-6">
          {Icon ? (
            <span
              aria-hidden
              className={cn(
                "app-dialog-pop relative mb-4 flex h-14 w-14 items-center justify-center rounded-full border",
                t.badge,
              )}
              style={{ boxShadow: `0 0 28px -4px ${t.glow}` }}
            >
              <span
                className={cn("app-dialog-halo pointer-events-none absolute inset-0 rounded-full border", t.badge)}
              />
              <Icon className={cn("h-6 w-6", iconClassName)} strokeWidth={1.75} />
            </span>
          ) : null}
          <div className="app-dialog-rise flex w-full flex-col items-center" style={{ animationDelay: "90ms" }}>
            <AlertDialogTitle className="text-balance font-heading text-[19px] font-semibold leading-snug tracking-tight text-white">
              {title}
            </AlertDialogTitle>
            {description ? (
              <AlertDialogDescription className="mt-2 max-w-[19rem] text-balance text-[14px] leading-relaxed text-white/65">
                {description}
              </AlertDialogDescription>
            ) : null}
            {children}
          </div>
        </div>
        {autoCloseMs ? (
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-white/[0.06]">
            <div
              key={String(open)}
              className="app-dialog-timer h-full bg-[var(--gym-gold)]/70"
              style={{ animationDuration: `${autoCloseMs}ms` }}
            />
          </div>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Pasek informacji w dialogu (np. „Do zjedzenia po usunięciu”). */
export function AppDialogStat({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-left",
        className,
      )}
    >
      <span className="text-[13px] text-white/65">{label}</span>
      <span className="text-[15px] font-semibold tabular-nums text-[var(--gym-gold)]">{value}</span>
    </div>
  );
}

export function AppDialogActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("mt-6 flex w-full flex-col gap-2.5", className)}>{children}</div>;
}

export type AppDialogButtonIntent = "primary" | "danger" | "quiet";

/** Klasy przycisku dialogu — też dla linków (`<a>`, `<Link>`). */
export function appDialogButtonClass(intent: AppDialogButtonIntent = "quiet", className?: string) {
  return cn(
    buttonVariants({
      variant: intent === "primary" ? "cta" : intent === "danger" ? "ghost" : "outline",
    }),
    "h-12 w-full rounded-2xl text-[15px] font-semibold transition-[transform,box-shadow,background-color,border-color] duration-150 active:translate-y-px active:scale-[0.985]",
    intent === "primary" &&
      "shadow-[0_10px_26px_-8px_rgba(221,187,109,0.6),inset_0_1px_0_rgba(255,255,255,0.35)] hover:shadow-[0_14px_32px_-8px_rgba(221,187,109,0.75),inset_0_1px_0_rgba(255,255,255,0.4)]",
    intent === "danger" &&
      "border-rose-500/40 bg-rose-500/15 text-rose-200 shadow-[0_10px_26px_-10px_rgba(244,63,94,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-rose-400/55 hover:bg-rose-500/25 hover:text-rose-100 hover:shadow-[0_14px_30px_-10px_rgba(244,63,94,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]",
    intent === "quiet" &&
      "border-[var(--gym-border-gold)] text-white/90 shadow-[0_6px_18px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)]",
    className,
  );
}

/** Przycisk akcji dialogu: primary = złoty CTA, danger = czerwony, quiet = obrys. */
export const AppDialogButton = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ComponentProps<typeof Button>, "variant" | "className"> & {
    intent?: AppDialogButtonIntent;
    className?: string;
  }
>(function AppDialogButton({ intent = "quiet", className, ...props }, ref) {
  return (
    <Button
      ref={ref}
      type="button"
      className={appDialogButtonClass(intent, className)}
      {...props}
    />
  );
});
