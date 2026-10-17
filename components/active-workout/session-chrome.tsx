"use client";

import type { ReactNode } from "react";
import { List, X } from "lucide-react";
import { hapticTap } from "@/lib/haptics";
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
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]",
        className,
      )}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="relative h-full rounded-full bg-gradient-to-r from-[#A8893F] via-[#D6B36A] to-[#F0D58A] transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 right-0 w-8 bg-gradient-to-r from-transparent to-white/35 blur-[1px]"
        />
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_12px_rgba(214,179,106,0.35)]"
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
      className="pt-[max(0.75rem,calc(env(safe-area-inset-top,0px)+0.5rem))]"
      data-session-chrome-header
    >
      {/*
        Safe-area jest na zewnętrznym wrapperze — className nie może
        nadpisać pt-* (wcześniej pt-3 na iOS chował X / listę pod status barem).
      */}
      <div
        className={cn(
          "relative flex items-start justify-between gap-2.5 px-3 pb-2",
          className,
        )}
      >
        <button
          type="button"
          onClick={() => {
            hapticTap();
            onClose?.();
          }}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/85 shadow-[0_0_20px_rgba(214,179,106,0.08)] transition hover:border-[#D6B36A]/35 hover:bg-white/[0.07]"
          aria-label="Zamknij sesję"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 pt-0.5 text-center">
          <p className="truncate text-[14px] font-semibold tracking-tight text-white sm:text-[15px]">
            {title}
          </p>
          <div className="mt-0.5 text-[11px] tabular-nums leading-snug text-white/55 sm:text-[12px]">
            {subtitle}
          </div>
        </div>
        {listDisabled || !onOpenList ? (
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 text-white/35">
            <List className="h-4 w-4" />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              hapticTap();
              onOpenList?.();
            }}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/85 shadow-[0_0_20px_rgba(214,179,106,0.08)] transition hover:border-[#D6B36A]/35 hover:bg-white/[0.07]"
            aria-label="Menu ćwiczeń"
          >
            <List className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
}
