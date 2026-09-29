"use client";

import type { ReactNode } from "react";
import { List, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SessionProgressBar({
  progress,
  className,
}: {
  progress: number;
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div
      className={cn("h-1.5 w-full bg-white/10", className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-gradient-to-r from-[var(--gym-gold-deep)] via-[var(--gym-gold)] to-[var(--gym-gold-bright)] transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function SessionChromeHeader({
  title,
  subtitle,
  onClose,
  onOpenList,
  listDisabled,
  className,
}: {
  title: string;
  subtitle: ReactNode;
  onClose?: () => void;
  onOpenList?: () => void;
  listDisabled?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "relative flex items-center justify-between gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/80 transition hover:bg-white/[0.08]"
        aria-label="Zamknij sesję"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="min-w-0 text-center">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
          {title}
        </p>
        <p className="mt-0.5 text-xs tabular-nums text-white/65">{subtitle}</p>
      </div>
      {listDisabled || !onOpenList ? (
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 text-white/35">
          <List className="h-4 w-4" />
        </span>
      ) : (
        <button
          type="button"
          onClick={onOpenList}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/80 transition hover:bg-white/[0.08]"
          aria-label="Lista ćwiczeń"
        >
          <List className="h-4 w-4" />
        </button>
      )}
    </header>
  );
}
