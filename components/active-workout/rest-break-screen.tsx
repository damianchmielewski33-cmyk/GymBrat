"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { SkipForward, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  readRestTimerPrefs,
  writeRestDefaultSeconds,
} from "@/lib/rest-timer-prefs";
import {
  SessionChromeHeader,
  SessionProgressBar,
} from "@/components/active-workout/session-chrome";

const PRESETS_SEC = [60, 90, 120, 180] as const;

function formatMmSs(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export type RestBreakScreenProps = {
  open: boolean;
  remaining: number;
  title: string;
  elapsedSeconds: number;
  setsDone: number;
  setsTotal: number;
  /** np. „Pompki · seria 1: 6 kg × 10” */
  completedLine: string | null;
  /** nagłówek dolnej sekcji */
  nextLabel: string;
  /** np. „Seria 2 z 2” albo nazwa ćwiczenia */
  nextValue: string;
  soundOn: boolean;
  onToggleSound: () => void;
  onAddSeconds: (sec: number) => void;
  onSetSeconds: (sec: number) => void;
  onContinue: () => void;
  onCloseSession?: () => void;
  onOpenList?: () => void;
};

/**
 * Pełnoekranowa PRZERWA: duży timer, złote presety, karta zaliczone/następne, Dalej.
 */
export function RestBreakScreen({
  open,
  remaining,
  title,
  elapsedSeconds,
  setsDone,
  setsTotal,
  completedLine,
  nextLabel,
  nextValue,
  soundOn,
  onToggleSound,
  onAddSeconds,
  onSetSeconds,
  onContinue,
  onCloseSession,
  onOpenList,
}: RestBreakScreenProps) {
  const [mounted, setMounted] = useState(false);
  const [rememberPreset, setRememberPreset] = useState(90);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setRememberPreset(readRestTimerPrefs().defaultSeconds);
  }, [open]);

  if (!open || !mounted) return null;

  const activePreset = PRESETS_SEC.includes(remaining as (typeof PRESETS_SEC)[number])
    ? remaining
    : PRESETS_SEC.reduce((best, p) =>
        Math.abs(p - remaining) < Math.abs(best - remaining) ? p : best,
      );

  const progress =
    setsTotal > 0 ? Math.min(1, Math.max(0, setsDone / setsTotal)) : 0;

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex flex-col bg-[var(--gym-black)] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(900px 420px at 50% 18%, rgba(235,196,74,0.16), transparent 58%), radial-gradient(700px 360px at 80% 100%, rgba(235,196,74,0.08), transparent 55%)",
        }}
        aria-hidden
      />

      <SessionProgressBar progress={progress} className="relative" />

      <SessionChromeHeader
        title={title}
        subtitle={`${formatMmSs(elapsedSeconds)} · ${setsDone}/${setsTotal} serii`}
        onClose={onCloseSession}
        onOpenList={onOpenList}
      />

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-[var(--gym-gold)]">
          Przerwa
        </p>
        <p className="mt-4 font-display text-[76px] leading-none tabular-nums tracking-tight text-[var(--gym-gold-bright)] drop-shadow-[0_0_40px_rgba(235,196,74,0.35)] sm:text-[92px]">
          {formatMmSs(remaining)}
        </p>

        <div className="mt-10 flex items-center justify-center gap-2.5 sm:gap-3">
          {PRESETS_SEC.map((sec) => {
            const active = activePreset === sec;
            return (
              <button
                key={sec}
                type="button"
                onClick={() => {
                  onSetSeconds(sec);
                  setRememberPreset(sec);
                  writeRestDefaultSeconds(sec);
                }}
                className={cn(
                  "inline-flex h-14 min-w-14 items-center justify-center rounded-full px-1 text-sm font-bold tabular-nums transition",
                  active
                    ? "gold-btn scale-105"
                    : "border border-white/15 bg-white/[0.04] text-white/70 hover:border-[var(--gym-gold)]/45 hover:text-white",
                )}
              >
                {formatMmSs(sec)}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            writeRestDefaultSeconds(rememberPreset);
          }}
          className="mt-5 rounded-full border border-[var(--gym-gold)]/25 bg-[var(--gym-gold)]/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold-bright)] transition hover:bg-[var(--gym-gold)]/18"
        >
          Zapamiętam przy tym ćwiczeniu
        </button>
      </div>

      <div className="app-card relative mx-4 mb-3 overflow-hidden px-4 py-4">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--gym-gold)]/50 to-transparent"
          aria-hidden
        />
        <p className="app-label">Zaliczone</p>
        <p className="mt-1.5 text-sm leading-snug text-white/90">
          {completedLine ?? "—"}
        </p>
        <div className="my-3 h-px bg-white/[0.08]" />
        <p className="app-label text-[var(--gym-gold)]">{nextLabel}</p>
        <p className="mt-1.5 font-display text-2xl leading-tight text-white">
          {nextValue}
        </p>
      </div>

      <div className="relative flex items-center gap-2.5 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => onAddSeconds(30)}
          className="gold-btn inline-flex h-14 w-[4.75rem] shrink-0 items-center justify-center rounded-2xl text-sm font-bold"
        >
          +30 s
        </button>
        <button
          type="button"
          onClick={onToggleSound}
          className={cn(
            "inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition",
            soundOn
              ? "gold-btn"
              : "border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10 text-[var(--gym-gold)]",
          )}
          aria-label={soundOn ? "Wycisz sygnał" : "Włącz sygnał"}
        >
          {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="gold-btn inline-flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold"
        >
          <SkipForward className="h-5 w-5" />
          Dalej
        </button>
      </div>
    </div>,
    document.body,
  );
}
