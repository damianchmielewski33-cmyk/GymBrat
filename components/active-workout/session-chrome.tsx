"use client";

import type { ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { SessionSegmentedProgress } from "@/components/active-workout/session-segmented-progress";
import {
  formatSessionClock,
  formatSessionClockSpoken,
} from "@/lib/active-workout-copy";
import { hapticTap } from "@/lib/haptics";
import type { SessionProgress } from "@/lib/workout-session-progress";

const iconBtnClass =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] text-white transition hover:border-[var(--gym-gold)]/40";

/**
 * Nagłówek sesji (ekran serii i przerwy): X, tytuł dnia, „trening m:ss · seria X/Y”,
 * plakietka (Ghost), menu ☰ i pasek segmentów.
 */
export function SessionChromeHeader({
  title,
  elapsedSeconds,
  progress,
  badge,
  onClose,
  onOpenMenu,
}: {
  title: string;
  elapsedSeconds: number;
  progress: SessionProgress;
  badge?: ReactNode;
  onClose?: () => void;
  onOpenMenu?: () => void;
}) {
  const setOrdinal = progress.currentOrdinal ?? progress.totalSets;
  return (
    <header
      className="shrink-0 bg-[var(--gym-black)] pt-[max(0.5rem,env(safe-area-inset-top,0px))]"
      data-session-chrome-header
    >
      <div className="flex items-start gap-2 px-3 pb-1 pt-2 compact:pt-1.5">
        <button
          type="button"
          onClick={() => {
            hapticTap();
            onClose?.();
          }}
          className={iconBtnClass}
          aria-label="Zamknij sesję"
        >
          <X className="size-4" />
        </button>
        <div className="min-w-0 flex-1 pt-0.5 text-center">
          <p
            className="truncate text-[15px] font-semibold leading-[18px] text-white compact:text-[14px] compact:leading-[17px]"
            title={title}
          >
            {title}
          </p>
          <p className="mt-0.5 text-[12px] leading-4 tabular-nums text-[var(--gym-text-secondary)] compact:text-[11px] compact:leading-[14px]">
            <span className="sr-only">
              Trening trwa {formatSessionClockSpoken(elapsedSeconds)}, seria {setOrdinal} z{" "}
              {progress.totalSets}
            </span>
            <span aria-hidden>
            trening{" "}
            <span className="font-semibold text-white">
              {formatSessionClock(elapsedSeconds)}
            </span>{" "}
            · seria{" "}
            <span className="font-semibold text-white">
              {setOrdinal}/{progress.totalSets}
            </span>
            </span>
          </p>
          {badge ? <div className="mt-1.5 flex justify-center compact:mt-1">{badge}</div> : null}
        </div>
        <button
          type="button"
          disabled={!onOpenMenu}
          onClick={() => {
            hapticTap();
            onOpenMenu?.();
          }}
          className={iconBtnClass}
          aria-label="Menu treningu"
          aria-haspopup="dialog"
        >
          <Menu className="size-4" />
        </button>
      </div>
      <SessionSegmentedProgress
        progress={progress}
        className="mx-4 mb-2.5 mt-1.5 compact:mb-2 compact:mt-1"
      />
    </header>
  );
}
