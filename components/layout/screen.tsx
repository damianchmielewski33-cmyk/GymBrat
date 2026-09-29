import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand-mark";
import { cn } from "@/lib/utils";

export const screenKickerClass =
  "text-[10px] font-bold uppercase tracking-wider text-white/35";

export const screenTitleClass =
  "font-heading text-2xl font-semibold text-white";

export const screenSubtitleClass = "text-sm text-white/60";

export const screenLinkClass =
  "rounded-sm text-[var(--neon)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708]";

export const screenCtaClass =
  "gym-btn-primary h-11 rounded-2xl px-5 text-base focus-visible:ring-2 focus-visible:ring-[rgba(var(--neon-rgb),0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708]";
export const screenInputClass =
  "min-h-11 border-white/20 bg-black/50 text-white placeholder:text-white/40";

/** Left-aligned dashboard page header (gold kicker + title). */
export const appPageKickerClass =
  "text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gym-gold)]";

export const appPageTitleClass =
  "font-heading text-[28px] font-semibold leading-tight tracking-tight text-white";

export const appPageSubtitleClass = "text-[13px] leading-relaxed text-white/45";

export function AppPageHeader({
  kicker,
  title,
  description,
  actions,
  className,
  titleAs: TitleTag = "h1",
}: {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleAs?: "h1" | "h2" | "p";
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 px-0.5 pb-1 pt-2",
        className,
      )}
    >
      <div className="min-w-0">
        {kicker ? <p className={appPageKickerClass}>{kicker}</p> : null}
        <TitleTag
          className={cn(appPageTitleClass, kicker ? "mt-1.5" : undefined)}
        >
          {title}
        </TitleTag>
        {description ? (
          <div className={cn(appPageSubtitleClass, "mt-2")}>{description}</div>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}

export function AppStatTile({
  value,
  label,
  tone = "gold",
  className,
}: {
  value: ReactNode;
  label: string;
  tone?: "gold" | "mint" | "muted";
  className?: string;
}) {
  return (
    <div className={cn("app-card px-3 py-3 text-center", className)}>
      <p
        className={cn(
          "font-display text-[26px] leading-none tabular-nums",
          tone === "gold" && "text-[var(--gym-gold)]",
          tone === "mint" && "text-emerald-300",
          tone === "muted" && "text-white/70",
        )}
      >
        {value}
      </p>
      <p className="app-label mt-1.5">{label}</p>
    </div>
  );
}

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
    <section className={cn("app-card p-6 sm:p-8", className)}>
      {children}
      {footer ? (
        <div className="mt-8 border-t border-white/10 pt-6">{footer}</div>
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
      <div>
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
      </div>
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
        className="mx-auto mt-6 h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-[var(--neon)]"
        aria-hidden
      />
      <p className={cn(screenSubtitleClass, "mt-4")}>{label}</p>
    </ScreenCard>
  );
}
