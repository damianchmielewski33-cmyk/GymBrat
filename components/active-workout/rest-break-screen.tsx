"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { List, SkipForward, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  readRestTimerPrefs,
  writeRestDefaultSeconds,
} from "@/lib/rest-timer-prefs";

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
 * Pełnoekranowa PRZERWA jak w aplikacji referencyjnej:
 * duży timer, presety 1:00–3:00, karta zaliczone/następne, Dalej.
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
    <div className="fixed inset-0 z-[220] flex flex-col bg-black text-white">
      <div
        className="h-1 w-full bg-white/10"
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-[var(--gym-gold)] transition-[width] duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onCloseSession}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 text-white/80"
          aria-label="Zamknij sesję"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="min-w-0 text-center">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
            {title}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-white/65">
            {formatMmSs(elapsedSeconds)} · {setsDone}/{setsTotal} serii
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenList}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 text-white/80"
          aria-label="Lista ćwiczeń"
        >
          <List className="h-4 w-4" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--gym-gold)]">
          Przerwa
        </p>
        <p className="mt-3 font-display text-[72px] leading-none tabular-nums text-[var(--gym-gold)] sm:text-[84px]">
          {formatMmSs(remaining)}
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
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
                  "inline-flex h-14 w-14 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition",
                  active
                    ? "border-2 border-[var(--gym-gold)] text-white"
                    : "border border-white/15 text-white/70",
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
          className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45"
        >
          Zapamiętam przy tym ćwiczeniu
        </button>
      </div>

      <div className="mx-4 mb-4 rounded-2xl border border-white/[0.08] bg-[#161616] px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
          Zaliczone
        </p>
        <p className="mt-1.5 text-sm leading-snug text-white/85">
          {completedLine ?? "—"}
        </p>
        <div className="my-3 h-px bg-white/[0.08]" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
          {nextLabel}
        </p>
        <p className="mt-1.5 font-display text-2xl leading-tight text-white">
          {nextValue}
        </p>
      </div>

      <div className="flex items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => onAddSeconds(30)}
          className="inline-flex h-14 w-16 shrink-0 items-center justify-center rounded-2xl border border-[var(--gym-gold)]/40 text-sm font-semibold text-[var(--gym-gold)]"
        >
          +30 s
        </button>
        <button
          type="button"
          onClick={onToggleSound}
          className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--gym-gold)]/40 text-[var(--gym-gold)]"
          aria-label={soundOn ? "Wycisz sygnał" : "Włącz sygnał"}
        >
          {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="gold-btn inline-flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl text-base font-semibold shadow-[0_8px_28px_rgba(var(--neon-rgb),0.35)]"
        >
          <SkipForward className="h-5 w-5" />
          Dalej
        </button>
      </div>
    </div>,
    document.body,
  );
}
