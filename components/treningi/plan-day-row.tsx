"use client";

import Link from "next/link";
import { useRef } from "react";
import { Check, EllipsisVertical, ListChecks, NotebookPen, Play } from "lucide-react";
import type { TreningiHubDay } from "@/lib/treningi-hub-data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MuscleGlyph } from "@/components/treningi/muscle-glyph";
import {
  formatPlanDayAriaLabel,
  formatPlanDayCaption,
  planDayDisplayName,
} from "@/lib/treningi-hub-format";
import { cn } from "@/lib/utils";

const rowTargetClass =
  "flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-l-[16px] py-2.5 pl-3 pr-1 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]";

const menuItemClass = "min-h-11 gap-3 rounded-lg px-3 text-[14px]";
const menuIconClass = "size-4 text-[var(--gym-gold)]";
/** Przyciemnia tylko etykietę i ikonę wyłączonej pozycji menu. */
const dimWhenDisabledClass = "group-data-disabled/dropdown-menu-item:opacity-50";

export function PlanDayRow({
  day,
  todayKey,
  isNext,
  starting,
  startDisabled,
  onStart,
  onPreview,
}: {
  day: TreningiHubDay;
  todayKey: string;
  isNext: boolean;
  /** Ten wiersz właśnie startuje sesję. */
  starting: boolean;
  /** Jakikolwiek start w toku — cele startu nieaktywne. */
  startDisabled: boolean;
  onStart: () => void;
  /** Otwiera podgląd; element zwraca fokus po zamknięciu arkusza. */
  onPreview: (returnFocusTo: HTMLElement | null) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { row, muscles, doneThisWeek } = day;
  const count = row.plan.exercises.length;
  const name = planDayDisplayName(row.plan.planName, row.dayNumber);
  const caption = formatPlanDayCaption(row.dayNumber, count, row.lastWorkoutDate, todayKey);
  const ariaLabel = formatPlanDayAriaLabel({
    dayNumber: row.dayNumber,
    planName: row.plan.planName,
    exerciseCount: count,
    muscleLabels: muscles?.labels ?? null,
    doneThisWeek,
    isNext,
    lastWorkoutDate: row.lastWorkoutDate,
    todayKey,
  });

  const content = (
    <>
      <span
        className={cn(
          "relative flex size-[42px] shrink-0 items-center justify-center rounded-xl bg-[var(--gym-surface-raised)]",
          isNext
            ? "border-[1.5px] border-[var(--gym-gold)]"
            : "border border-white/[0.08]",
        )}
      >
        <MuscleGlyph summary={muscles} size="row" />
        {doneThisWeek ? (
          <span
            aria-hidden
            className="absolute -right-[5px] -top-[5px] flex size-4 items-center justify-center rounded-full bg-[var(--gym-gold)] shadow-[0_0_0_2px_var(--gym-surface-sunken)]"
          >
            <Check className="size-2.5 text-[var(--gym-on-gold)]" strokeWidth={3.5} />
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-white" title={name}>
          {name}
        </span>
        {/* Region live stały w DOM, żeby zmiana na „Startuję…” została ogłoszona. */}
        <span
          className="mt-0.5 line-clamp-2 block text-[12px] tabular-nums text-white/60"
          aria-live="polite"
        >
          {starting ? "Startuję…" : caption}
        </span>
      </span>
      {isNext ? (
        <span
          aria-hidden
          className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--gym-gold)]"
        >
          Następny
        </span>
      ) : null}
    </>
  );

  return (
    <li className="flex items-center">
      {count === 0 ? (
        <Link
          href="/profile/workout-plan"
          aria-label={ariaLabel}
          className={cn(rowTargetClass, startDisabled && "pointer-events-none opacity-60")}
          aria-disabled={startDisabled || undefined}
          tabIndex={startDisabled ? -1 : undefined}
        >
          {content}
        </Link>
      ) : (
        <button
          type="button"
          aria-label={ariaLabel}
          aria-disabled={startDisabled || undefined}
          aria-busy={starting || undefined}
          className={cn(rowTargetClass, startDisabled && "opacity-60")}
          onClick={() => {
            if (!startDisabled) onStart();
          }}
        >
          {content}
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          ref={triggerRef}
          type="button"
          aria-label={`Więcej opcji: ${row.plan.planName.trim() ? `Dzień ${row.dayNumber}, ${name}` : name}`}
          className="mr-1.5 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-white/70 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <EllipsisVertical className="size-5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-auto min-w-[13rem] rounded-xl border border-white/10 bg-[var(--gym-surface-raised)] p-1.5 text-white motion-reduce:animate-none"
        >
          <DropdownMenuItem
            className={cn(
              menuItemClass,
              "data-disabled:opacity-100",
              count === 0 && "items-start py-2",
            )}
            disabled={count === 0 || startDisabled}
            onClick={onStart}
          >
            <Play
              className={cn(
                menuIconClass,
                dimWhenDisabledClass,
                count === 0 && "mt-0.5",
              )}
              aria-hidden
            />
            {count === 0 ? (
              <span className="flex flex-col">
                <span className={dimWhenDisabledClass}>Rozpocznij trening</span>
                {/* Powód to treść informacyjna: pełny kontrast (LR-5), nie przyciemniamy. */}
                <span className="text-[12px] text-white/60">Brak ćwiczeń w tym dniu</span>
              </span>
            ) : (
              <span className={dimWhenDisabledClass}>Rozpocznij trening</span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={menuItemClass}
            render={<Link href="/workout-history" />}
          >
            <NotebookPen className={menuIconClass} aria-hidden />
            Dziennik obciążeń
          </DropdownMenuItem>
          <DropdownMenuItem
            className={menuItemClass}
            onClick={() => onPreview(triggerRef.current)}
          >
            <ListChecks className={menuIconClass} aria-hidden />
            Podgląd ćwiczeń
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
