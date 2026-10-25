"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";
import { Check, Play, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GhostPickerSheet } from "@/components/active-workout/ghost-picker-sheet";
import { SessionChromeHeader } from "@/components/active-workout/session-chrome";
import { SetSuggestionRow } from "@/components/active-workout/set-suggestion-row";
import { scrollEdgeFadeMaskImage, useScrollEdgeFade } from "@/hooks/use-scroll-edge-fade";
import {
  formatExerciseSchemeParts,
  formatRepTarget,
  formatSessionClockSpoken,
} from "@/lib/active-workout-copy";
import { hapticTap } from "@/lib/haptics";
import { formatClockMmSs, plural } from "@/lib/progress-format";
import type { RestCompletedSet, RestNextStep } from "@/lib/rest-next-step";
import { writeRestDefaultSeconds } from "@/lib/rest-timer-prefs";
import { formatKgPl } from "@/lib/set-progression-suggestion";
import type { SessionProgress } from "@/lib/workout-session-progress";
import { cn } from "@/lib/utils";

const SHORTEN_SECONDS = 15;
const EXTEND_SECONDS = 30;
/** Ostatnie sekundy przerwy: cyfry jaśniejsze (bez pulsowania). */
const URGENT_SECONDS = 10;

const PRESETS: Array<{ sec: number; label: string }> = [
  { sec: 60, label: "60 s" },
  { sec: 90, label: "90 s" },
  { sec: 120, label: "2 min" },
  { sec: 180, label: "3 min" },
];

const adjustBtnClass =
  "inline-flex h-11 min-w-[76px] items-center justify-center rounded-full border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] px-3 text-[14px] font-bold tabular-nums text-white transition hover:border-[var(--gym-gold)]/40";

function dismissMobileKeyboard() {
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
  const probe = document.createElement("input");
  probe.setAttribute("readonly", "true");
  probe.setAttribute("inputmode", "none");
  probe.style.cssText =
    "position:fixed;left:0;top:0;opacity:0;height:0;width:0;border:0;padding:0;";
  document.body.appendChild(probe);
  probe.focus({ preventScroll: true });
  probe.blur();
  document.body.removeChild(probe);
}

/** Ogłoszenie dla czytnika tylko przy 0:30 i 0:10 (licznik ma aria-live="off"). */
function restAnnouncement(remaining: number): string {
  if (remaining <= URGENT_SECONDS) return "Zostało 10 sekund przerwy";
  if (remaining <= 30) return "Zostało 30 sekund przerwy";
  return "";
}

function TimerRing({ remaining, totalSeconds }: { remaining: number; totalSeconds: number }) {
  const ratio = Math.min(1, Math.max(0, remaining / Math.max(1, totalSeconds)));
  const r = 46;
  const c = 2 * Math.PI * r;
  const urgent = remaining <= URGENT_SECONDS;
  return (
    <div
      className="relative aspect-square w-[min(54vw,28dvh,224px)]"
      role="timer"
      aria-live="off"
      aria-label={`Przerwa, zostało ${formatSessionClockSpoken(remaining)}`}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth={2.5} className="stroke-[var(--gym-track)]" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          className="stroke-[var(--gym-gold)] transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none"
        />
      </svg>
      <div aria-hidden className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "font-display text-[76px] leading-none tabular-nums compact:text-[60px]",
            urgent ? "text-[var(--gym-gold-bright)]" : "text-[var(--gym-gold)]",
          )}
        >
          {formatClockMmSs(remaining)}
        </span>
        <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--gym-text-secondary)] compact:mt-0.5">
          przerwa
        </span>
      </div>
    </div>
  );
}

function SavedCard({ completed }: { completed: RestCompletedSet }) {
  return (
    <div
      role="status"
      className="flex min-h-[52px] items-center gap-2.5 rounded-2xl border border-[var(--gym-success)]/45 bg-[var(--gym-success)]/10 px-3 py-2 compact:min-h-11 compact:py-1"
    >
      <span
        aria-hidden
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--gym-success)] text-[var(--gym-black)]"
      >
        <Check className="size-4" strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold leading-4 text-[var(--gym-success)] compact:text-[11px] compact:leading-[14px]">
          Zapisano
        </p>
        <p className="text-[16px] font-semibold leading-5 tabular-nums text-white compact:text-[15px] compact:leading-[18px]">
          <span className="text-[var(--gym-success)]">
            {formatKgPl(completed.weightKg)} kg × {completed.reps}
          </span>
          {completed.rir != null ? ` · RIR ${completed.rir}` : null}
        </p>
      </div>
      {completed.exerciseCompleted ? (
        <span className="shrink-0 rounded-full border border-[var(--gym-success)]/50 px-2 py-0.5 text-[12px] font-bold text-[var(--gym-success)]">
          ćwiczenie ✓
        </span>
      ) : null}
    </div>
  );
}

function NextCard({ next, exercisesTotal }: { next: RestNextStep; exercisesTotal: number }) {
  const sameExercise = next.kind === "set";
  const scheme = sameExercise
    ? [
        ...(formatRepTarget(next.targetReps) ? [`cel ${formatRepTarget(next.targetReps)}`] : []),
        ...(next.targetRir != null ? [`RIR ${next.targetRir}`] : []),
      ]
    : formatExerciseSchemeParts({
        sets: next.setsInExercise,
        targetReps: next.targetReps,
        targetRir: next.targetRir,
      });
  const hasHistory =
    next.lastSessionSet != null &&
    (next.lastSessionSet.weight > 0 || (next.lastSessionSet.reps ?? 0) > 0);
  return (
    <section className="rounded-[18px] border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] p-3 compact:px-3 compact:py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
        {sameExercise
          ? "Następnie"
          : `Następnie · ćwiczenie ${next.exerciseOrdinal} z ${exercisesTotal}`}
      </p>
      <p className="mt-1 truncate text-[17px] font-semibold text-white compact:text-[16px]">
        {sameExercise
          ? `Seria ${next.setOrdinal} z ${next.setsInExercise} · ${next.exerciseName}`
          : next.exerciseName}
      </p>
      {scheme.length > 0 ? (
        <p className="mt-0.5 text-[13px] tabular-nums text-[var(--gym-text-secondary)]">
          {scheme.join(" · ")}
        </p>
      ) : null}
      {next.suggestion || hasHistory ? (
        <SetSuggestionRow
          suggestion={next.suggestion}
          lastSet={next.lastSessionSet}
          className="mt-2.5 bg-[var(--gym-black)] compact:mt-1.5"
        />
      ) : null}
    </section>
  );
}

function WorkoutEndCard({ progress }: { progress: SessionProgress }) {
  const skipped = progress.skippedSets;
  return (
    <section className="rounded-[18px] border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] p-3 compact:px-3 compact:py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
        Trening zakończony
      </p>
      <p className="mt-1 text-[17px] font-semibold text-white compact:text-[16px]">
        Wszystkie serie za tobą
      </p>
      <p className="mt-0.5 text-[13px] tabular-nums text-[var(--gym-text-secondary)]">
        Zapisano {progress.savedSets} z {progress.totalSets} serii
        {skipped > 0
          ? ` · ${skipped} ${plural(skipped, "pominięta", "pominięte", "pominiętych")}`
          : null}
      </p>
    </section>
  );
}

export type RestBreakScreenProps = {
  open: boolean;
  remaining: number;
  durationTotal: number;
  /** Tytuł sesji w nagłówku (np. „Pull”). */
  title: string;
  elapsedSeconds: number;
  planId: string | null;
  progress: SessionProgress;
  completed: RestCompletedSet | null;
  /** null = koniec treningu. */
  next: RestNextStep | null;
  soundOn: boolean;
  onToggleSound: () => void;
  /** Zmiana pozostałego czasu (ujemna skraca; 0 kończy przerwę). */
  onAdjustSeconds: (deltaSec: number) => void;
  onSetSeconds: (sec: number) => void;
  onContinue: () => void;
  onCloseSession?: () => void;
  onOpenMenu?: () => void;
};

/** Pełnoekranowa przerwa po zapisaniu serii (ekran B). */
export function RestBreakScreen({
  open,
  remaining,
  durationTotal,
  title,
  elapsedSeconds,
  planId,
  progress,
  completed,
  next,
  soundOn,
  onToggleSound,
  onAdjustSeconds,
  onSetSeconds,
  onContinue,
  onCloseSession,
  onOpenMenu,
}: RestBreakScreenProps) {
  const continueRef = useRef<HTMLButtonElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  // Wskazówka krawędzi (ux, przegląd wizualny, runda 2, obserwacja niska): karta
  // „Następnie” bywa niżej niż widoczna część kolumny; przewijanie działa (`overflow-y:auto`),
  // ale bez sygnału. Ten sam wzorzec co pigułki serii, tylko w osi pionowej.
  const contentEdge = useScrollEdgeFade(contentScrollRef, "y", [next, completed]);
  const contentMaskImage = scrollEdgeFadeMaskImage("y", contentEdge);

  useEffect(() => {
    if (!open) return;
    dismissMobileKeyboard();
    const t = window.setTimeout(() => {
      dismissMobileKeyboard();
      continueRef.current?.focus({ preventScroll: true });
    }, 50);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const ringTotal = Math.max(durationTotal, remaining, 1);
  const ctaLabel = !next
    ? "Zakończ trening"
    : next.kind === "set"
      ? `Zacznij serię ${next.setOrdinal}`
      : `Zacznij ćwiczenie ${next.exerciseOrdinal}`;

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex flex-col bg-[var(--gym-black)] text-white">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-col">
        <SessionChromeHeader
          title={title || "Trening"}
          elapsedSeconds={elapsedSeconds}
          progress={progress}
          badge={<GhostPickerSheet planId={planId} />}
          onClose={onCloseSession}
          onOpenMenu={onOpenMenu}
        />

        <div
          ref={contentScrollRef}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-3 compact:gap-2 compact:py-2"
          style={contentMaskImage ? { maskImage: contentMaskImage, WebkitMaskImage: contentMaskImage } : undefined}
        >
          {completed ? <SavedCard completed={completed} /> : null}

          <div className="flex flex-col items-center gap-2.5 compact:gap-1.5">
            <TimerRing remaining={remaining} totalSeconds={ringTotal} />
            <p className="sr-only" aria-live="polite">
              {restAnnouncement(remaining)}
            </p>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  onAdjustSeconds(-SHORTEN_SECONDS);
                }}
                aria-label={`Skróć przerwę o ${SHORTEN_SECONDS} sekund`}
                className={adjustBtnClass}
              >
                −{SHORTEN_SECONDS} s
              </button>
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  onAdjustSeconds(EXTEND_SECONDS);
                }}
                aria-label={`Wydłuż przerwę o ${EXTEND_SECONDS} sekund`}
                className={adjustBtnClass}
              >
                +{EXTEND_SECONDS} s
              </button>
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  onToggleSound();
                }}
                aria-pressed={soundOn}
                aria-label={`Sygnał końca przerwy: ${soundOn ? "włączony" : "wyłączony"}`}
                className={cn(adjustBtnClass, "w-11 min-w-11 px-0 text-[var(--gym-gold)]")}
              >
                {soundOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((p) => {
              const active = durationTotal === p.sec;
              return (
                <button
                  key={p.sec}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    hapticTap();
                    onSetSeconds(p.sec);
                    writeRestDefaultSeconds(p.sec);
                  }}
                  className="-my-0.5 inline-flex h-11 items-center justify-center"
                >
                  <span
                    className={cn(
                      "inline-flex h-10 w-full items-center justify-center rounded-full border text-[13px] font-bold tabular-nums transition",
                      active
                        ? "border-[var(--gym-gold-bright)]/70 bg-[var(--gym-gold)] text-[var(--gym-on-gold)]"
                        : "border-[var(--gym-gold)]/32 text-white/75 hover:text-white",
                    )}
                  >
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>

          {next ? (
            <NextCard next={next} exercisesTotal={progress.exercisesTotal} />
          ) : (
            <WorkoutEndCard progress={progress} />
          )}
        </div>

        <div className="shrink-0 border-t border-white/[0.06] bg-[var(--gym-black)] px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5 compact:pt-2">
          <Button
            ref={continueRef}
            type="button"
            variant="cta"
            onClick={() => {
              hapticTap();
              if (PRESETS.some((p) => p.sec === remaining)) {
                writeRestDefaultSeconds(remaining);
              }
              onContinue();
            }}
            className="h-14 w-full gap-2 text-[17px] compact:h-[52px]"
          >
            {next ? <Play className="size-5 fill-current" strokeWidth={0} /> : null}
            {ctaLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
