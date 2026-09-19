import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand-mark";
import { cn } from "@/lib/utils";

export const screenKickerClass =
  "text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--mp-teal-dark)]";

export const screenTitleClass =
  "font-heading text-2xl font-semibold tracking-tight text-zinc-950";

export const screenSubtitleClass = "text-sm text-zinc-500";

export const screenLinkClass =
  "rounded-sm text-[var(--neon)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const screenCtaClass =
  "h-11 bg-[var(--neon)] text-base font-semibold text-white hover:bg-[var(--neon-hover)] focus-visible:ring-2 focus-visible:ring-[var(--mp-teal)]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const screenInputClass =
  "min-h-11 border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400";

export function ScreenCard({
  children,
  className,
  footer,
}: {
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  return (
    <section className={cn("glass-panel p-8", className)}>
      {children}
      {footer ? (
        <div className="mt-8 border-t border-zinc-200 pt-6">{footer}</div>
      ) : null}
    </section>
  );
}

export function ScreenHeading({
  kicker,
  title,
  description,
  showBrand = false,
  className,
  titleAs: TitleTag = "h1",
}: {
  kicker?: string;
  title?: ReactNode;
  description?: ReactNode;
  showBrand?: boolean;
  className?: string;
  titleAs?: "h1" | "h2" | "p";
}) {
  return (
    <div className={cn("text-center", className)}>
      {showBrand ? <BrandMark /> : null}
      {kicker ? (
        <p className={cn(screenKickerClass, showBrand ? "mt-2" : undefined)}>
          {kicker}
        </p>
      ) : null}
      {title ? (
        <TitleTag
          className={cn(
            screenTitleClass,
            kicker || showBrand ? "mt-2" : undefined,
          )}
        >
          {title}
        </TitleTag>
      ) : null}
      {description ? (
        <div className={cn(screenSubtitleClass, "mx-auto mt-2 max-w-lg")}>
          {description}
        </div>
      ) : null}
    </div>
  );
}

export function ScreenHeader({
  kicker,
  title,
  description,
  actions,
  showBrand = false,
  className,
}: {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  showBrand?: boolean;
  className?: string;
}) {
  return (
    <ScreenCard className={className}>
      <ScreenHeading
        kicker={kicker}
        title={title}
        description={description}
        showBrand={showBrand}
        className={actions ? "mb-8" : undefined}
      />
      {actions ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {actions}
        </div>
      ) : null}
    </ScreenCard>
  );
}

export function ScreenLoading({
  label = "Ładowanie…",
}: {
  label?: string;
}) {
  return (
    <ScreenCard className="mx-auto max-w-md text-center">
      <BrandMark as="span" />
      <div
        className="mx-auto mt-6 h-9 w-9 animate-spin rounded-full border-2 border-zinc-200 border-t-[var(--neon)]"
        aria-hidden
      />
      <p className={cn(screenSubtitleClass, "mt-4")}>{label}</p>
    </ScreenCard>
  );
}
