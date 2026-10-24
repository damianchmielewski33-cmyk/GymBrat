"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { X } from "lucide-react";
import type { WorkoutExerciseState } from "@/components/workout/types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatExerciseSchemeParts } from "@/lib/active-workout-copy";
import type {
  SessionProgress,
  SessionProgressSegment,
} from "@/lib/workout-session-progress";
import { cn } from "@/lib/utils";

const actionClass =
  "inline-flex min-h-11 items-center justify-center rounded-[14px] border border-[var(--gym-border-gold)] bg-[var(--gym-black)] px-3 text-center text-[13px] font-semibold text-white transition hover:border-[var(--gym-gold)]/40";

function dotClass(seg: SessionProgressSegment): string {
  if (seg.state === "saved") return "bg-[var(--gym-success)]";
  if (seg.state === "skipped") {
    return "bg-transparent shadow-[inset_0_0_0_1.5px_var(--gym-skipped)]";
  }
  return "bg-[var(--gym-track)]";
}

function schemeLine(ex: WorkoutExerciseState): string {
  return formatExerciseSchemeParts({
    sets: ex.targetSets ?? ex.sets.length,
    targetReps: ex.targetReps,
    targetRir: ex.targetRir,
    tempo: ex.tempo,
  }).join(" · ");
}

/**
 * Menu treningu (☰): lista ćwiczeń, akcje bieżącego ćwiczenia i „Zakończ trening” (D5, BR-10).
 */
export function SessionMenuSheet({
  open,
  onOpenChange,
  title,
  exercises,
  progress,
  currentExerciseId,
  onSelectExercise,
  onAddSet,
  onRemoveLastSet,
  note,
  onNoteChange,
  onReportProblem,
  onFinish,
  finishPending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  exercises: WorkoutExerciseState[];
  progress: SessionProgress;
  currentExerciseId: string;
  onSelectExercise: (exerciseId: string) => void;
  onAddSet?: () => void;
  /** Brak = akcja niedostępna (np. jedna seria). */
  onRemoveLastSet?: () => void;
  note: string;
  onNoteChange?: (note: string) => void;
  onReportProblem: () => void;
  onFinish?: () => void;
  finishPending?: boolean;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        initialFocus={closeRef}
        overlayClassName="bg-[var(--gym-black)]"
        className="inset-0 gap-0 border-0 bg-[var(--gym-black)] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,calc(env(safe-area-inset-top,0px)+0.5rem))] data-[side=right]:w-full data-[side=right]:border-0 data-[side=right]:sm:max-w-none"
      >
        <header className="flex items-start justify-between gap-3 px-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
              Menu treningu
            </p>
            <SheetTitle className="mt-0.5 truncate text-[24px] font-semibold leading-[1.1] text-white">
              {title}
            </SheetTitle>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Zamknij menu"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] text-white"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-[22px] border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] p-1.5">
          <ul>
            {exercises.map((ex, i) => {
              const group = progress.groups[i];
              const active = ex.id === currentExerciseId;
              const completed = group?.completed ?? false;
              return (
                <li key={ex.id}>
                  <button
                    type="button"
                    onClick={() => onSelectExercise(ex.id)}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-2.5 rounded-[14px] px-2.5 py-2 text-left",
                      active ? "bg-[var(--gym-gold)]/8" : "hover:bg-white/[0.03]",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-[15px] font-semibold",
                          completed
                            ? "text-[var(--gym-success)]"
                            : active
                              ? "text-[var(--gym-gold)]"
                              : "text-white",
                        )}
                      >
                        {completed ? "✓ " : ""}
                        {i + 1}. {ex.name}
                      </span>
                      <span className="block truncate text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
                        {active ? "teraz · " : ""}
                        {schemeLine(ex)}
                      </span>
                    </span>
                    <span aria-hidden className="flex shrink-0 items-center gap-1">
                      {(group?.segments ?? []).map((seg) => (
                        <span
                          key={seg.setIndex}
                          className={cn("size-2 rounded-full", dotClass(seg))}
                        />
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="mx-1 mb-1.5 mt-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
            Bieżące ćwiczenie
          </p>
          <div className="grid grid-cols-2 gap-2">
            {onAddSet ? (
              <button type="button" onClick={onAddSet} className={actionClass}>
                + Dodaj serię
              </button>
            ) : null}
            {onRemoveLastSet ? (
              <button type="button" onClick={onRemoveLastSet} className={actionClass}>
                Usuń ostatnią serię
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setNoteOpen((v) => !v)}
              aria-expanded={noteOpen}
              className={actionClass}
            >
              Notatka
            </button>
            <Link
              href="/technique"
              onClick={() => onOpenChange(false)}
              className={actionClass}
            >
              Nagraj technikę
            </Link>
            <button
              type="button"
              onClick={onReportProblem}
              className={cn(actionClass, "col-span-2")}
            >
              Zgłoś problem z ćwiczeniem
            </button>
          </div>
          {noteOpen ? (
            <Textarea
              value={note}
              onChange={(e) => onNoteChange?.(e.target.value)}
              placeholder="Notatka do ćwiczenia…"
              aria-label="Notatka do ćwiczenia"
              className="mt-2 min-h-14 rounded-xl border-[var(--gym-border-gold)] bg-[var(--gym-black)] text-sm text-white"
            />
          ) : null}
        </div>

        {onFinish ? (
          <Button
            type="button"
            variant="outline"
            disabled={finishPending}
            onClick={onFinish}
            className="mt-3 h-12 w-full text-[15px] font-bold text-[var(--gym-gold-bright)]"
          >
            {finishPending ? "Kończenie…" : "Zakończ trening"}
          </Button>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
