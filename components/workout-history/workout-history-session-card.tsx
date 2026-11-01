"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { deleteCompletedWorkout } from "@/actions/workout-history";
import { Button } from "@/components/ui/button";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  WorkoutHistoryCompareBlock,
  WorkoutHistoryCompareChip,
  compareChipAriaText,
} from "@/components/workout-history/workout-history-compare-delta";
import { WorkoutHistoryExerciseList } from "@/components/workout-history/workout-history-exercise-list";
import { WorkoutHistorySessionDeleteDialog } from "@/components/workout-history/workout-history-session-delete-dialog";
import type { WorkoutHistoryCard } from "@/lib/workout-history-overview";
import {
  canEditWorkout,
  formatEditDeadline,
  formatHistoryExercisesLabel,
  formatHistoryKg,
  formatHistorySessionDateParts,
  formatHistoryShortDate,
  formatSetsLabel,
  workoutEditDeadlineMs,
} from "@/lib/workout-history-overview";
import { cn } from "@/lib/utils";

const LONG_PRESS_MS = 520;

type Props = {
  card: WorkoutHistoryCard;
  expanded: boolean;
  highlight: boolean;
  onToggle: () => void;
  onDeleted: (id: string) => void;
  onHighlightDone: () => void;
};

export function WorkoutHistorySessionCard({
  card,
  expanded,
  highlight,
  onToggle,
  onDeleted,
  onHighlightDone,
}: Props) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const rowRef = useRef<HTMLDivElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pressing, setPressing] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [alreadyGone, setAlreadyGone] = useState(false);
  const timerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const editable = canEditWorkout(card.endedAt, card.date);
  const deadlineLabel = formatEditDeadline(
    workoutEditDeadlineMs(card.endedAt, card.date),
  );
  const label = card.planLabel || card.title;
  const dateParts = formatHistorySessionDateParts(card.date);
  const meta = [
    card.durationMinutes != null ? `${card.durationMinutes} min` : null,
    formatSetsLabel(card.setsDone),
    formatHistoryExercisesLabel(card.exerciseCount),
  ]
    .filter(Boolean)
    .join(" · ");

  const detailsId = `history-session-${card.id}`;

  useEffect(() => {
    if (!highlight || !rowRef.current) return;
    rowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = window.setTimeout(() => onHighlightDone(), 2000);
    return () => window.clearTimeout(t);
  }, [highlight, onHighlightDone]);

  function clearLongPressTimer() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPressing(false);
  }

  function startLongPress() {
    longPressFiredRef.current = false;
    clearLongPressTimer();
    setPressing(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      longPressFiredRef.current = true;
      setPressing(false);
      setDeleteError(null);
      setAlreadyGone(false);
      setDeleteOpen(true);
      try {
        navigator.vibrate?.(12);
      } catch {
        /* ignore */
      }
    }, LONG_PRESS_MS);
  }

  function confirmDelete() {
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteCompletedWorkout({ workoutId: card.id });
      if (!res.ok) {
        if (res.error.includes("Nie znaleziono")) {
          setAlreadyGone(true);
          onDeleted(card.id);
          router.refresh();
          return;
        }
        setDeleteError(
          "Nie udało się usunąć treningu. Sprawdź połączenie. Wpis zostaje na liście.",
        );
        notifyError(res.error);
        return;
      }
      setDeleteOpen(false);
      onDeleted(card.id);
      notifySaved("Usunięto trening z historii.");
      router.refresh();
    });
  }

  const ariaLabel = [
    label,
    dateParts.isRelative ? dateParts.weekday : dateParts.day,
    formatHistoryKg(card.volumeKg),
    compareChipAriaText(card),
    expanded ? "Ukryj szczegóły" : "Pokaż szczegóły",
  ].join(", ");

  return (
    <div
      ref={rowRef}
      className={cn(
        highlight && "shadow-[inset_0_0_0_2px_var(--gym-gold)]",
        "motion-reduce:transition-none",
      )}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        aria-label={ariaLabel}
        onClick={() => {
          if (longPressFiredRef.current) {
            longPressFiredRef.current = false;
            return;
          }
          onToggle();
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          startLongPress();
        }}
        onPointerUp={clearLongPressTimer}
        onPointerCancel={clearLongPressTimer}
        onLostPointerCapture={clearLongPressTimer}
        onContextMenu={(e) => {
          e.preventDefault();
          clearLongPressTimer();
          longPressFiredRef.current = true;
          setDeleteError(null);
          setAlreadyGone(false);
          setDeleteOpen(true);
        }}
        className={cn(
          "flex min-h-[72px] w-full items-center gap-3 px-3.5 py-3 text-left select-none transition",
          "active:bg-white/[0.04]",
          (pressing || expanded) && "bg-white/[0.02]",
        )}
      >
        <div className="w-12 shrink-0">
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.1em] leading-tight",
              dateParts.isRelative
                ? "text-[var(--gym-gold)]"
                : "text-[var(--gym-text-secondary)]",
            )}
          >
            {dateParts.weekday}
          </p>
          <p className="mt-0.5 font-heading text-[15px] tabular-nums leading-tight text-white">
            {dateParts.day}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">{label}</p>
          <p className="mt-0.5 truncate text-[12px] text-[var(--gym-text-secondary)]">
            {meta}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-heading text-[16px] tabular-nums leading-none text-white">
            {formatHistoryKg(card.volumeKg)}
          </p>
          <WorkoutHistoryCompareChip card={card} />
          <ChevronDown
            className={cn(
              "ml-auto mt-1.5 block h-5 w-5 text-[var(--gym-text-secondary)] transition",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        </div>
      </button>

      {expanded ? (
        <div
          id={detailsId}
          className="space-y-4 border-t border-white/[0.06] bg-white/[0.015] px-3.5 pb-4 pt-3"
        >
          <WorkoutHistoryCompareBlock card={card} />
          <WorkoutHistoryExerciseList exercises={card.exercises} />

          <div className="space-y-2 pt-1">
            <div className="flex gap-2">
              {editable ? (
                <Link
                  href={`/workout-history/${card.id}/edit`}
                  className={cn(
                    "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--gym-border-gold)] text-[14px] font-semibold text-white",
                    "transition hover:bg-white/[0.04]",
                  )}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                  Popraw
                </Link>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-12 gap-2 rounded-2xl border border-[rgba(255,51,71,0.45)] text-[14px] font-semibold text-[#ff8593]",
                  editable ? "flex-1" : "w-full",
                  "hover:bg-rose-950/30",
                )}
                onClick={() => {
                  setDeleteError(null);
                  setAlreadyGone(false);
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Usuń trening
              </Button>
            </div>
            <p className="text-[12px] leading-4 text-[var(--gym-text-secondary)]">
              {editable
                ? `Edycja do ${deadlineLabel}.`
                : "Edycja niedostępna po 7 dniach."}
            </p>
          </div>
        </div>
      ) : null}

      <WorkoutHistorySessionDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        label={label}
        dateLabel={formatHistoryShortDate(card.date)}
        pending={pending}
        error={deleteError}
        alreadyGone={alreadyGone}
        onConfirm={confirmDelete}
        onRetry={confirmDelete}
      />
    </div>
  );
}
