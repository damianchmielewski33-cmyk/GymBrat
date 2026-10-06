"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
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

function dismissMobileKeyboard() {
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
  // iOS: blur samego inputu czasem nie chowa klawiatury — przełącz fokus na readonly.
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

function formatMmSs(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Płynne odliczanie między tickami sekundowymi — koło nie skacze co 1 s. */
function useSmoothRemaining(remaining: number, open: boolean) {
  const [smooth, setSmooth] = useState(remaining);
  const tickFromRef = useRef(remaining);
  const tickAtRef = useRef(typeof performance !== "undefined" ? performance.now() : 0);

  useEffect(() => {
    tickFromRef.current = remaining;
    tickAtRef.current = performance.now();
    setSmooth(remaining);
  }, [remaining]);

  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const loop = (now: number) => {
      const elapsed = (now - tickAtRef.current) / 1000;
      setSmooth(Math.max(0, tickFromRef.current - elapsed));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open, remaining]);

  return smooth;
}

function RestCountdownClock({
  remaining,
  totalSeconds,
}: {
  remaining: number;
  totalSeconds: number;
}) {
  const smooth = useSmoothRemaining(remaining, true);
  const total = Math.max(1, totalSeconds);
  const ratio = Math.min(1, Math.max(0, smooth / total));

  const size = 236;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - ratio);
  const urgent = remaining <= 10;

  return (
    <div
      className="relative mx-auto flex items-center justify-center"
      style={{ width: size, height: size }}
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`Pozostało ${formatMmSs(remaining)}`}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 h-full w-full -rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={urgent ? "var(--gym-gold-bright)" : "var(--gym-gold)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
          className={cn(
            "drop-shadow-[0_0_14px_rgba(235,196,74,0.45)]",
            urgent && "drop-shadow-[0_0_22px_rgba(235,196,74,0.7)]",
          )}
          style={{ transition: "stroke 200ms ease" }}
        />
      </svg>

      <div className="relative z-[1] flex flex-col items-center justify-center px-4 text-center">
        <p
          className="font-display text-[64px] leading-none tabular-nums tracking-tight text-[var(--gym-gold-bright)] sm:text-[72px]"
          style={{
            textShadow: urgent
              ? "0 0 28px rgba(235,196,74,0.55)"
              : "0 0 36px rgba(235,196,74,0.35)",
          }}
        >
          {formatMmSs(remaining)}
        </p>
      </div>
    </div>
  );
}

export type RestBreakScreenProps = {
  open: boolean;
  remaining: number;
  /** Pełny czas bieżącego cyklu przerwy (do animacji koła). */
  durationTotal: number;
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
  /** Aktywna rada na następną serię (ciężar / powtórzenia). */
  coachTip?: string | null;
  soundOn: boolean;
  onToggleSound: () => void;
  onAddSeconds: (sec: number) => void;
  onSetSeconds: (sec: number) => void;
  onContinue: () => void;
  onCloseSession?: () => void;
  onOpenList?: () => void;
};

/**
 * Pełnoekranowa PRZERWA: zegar w kole odliczającym, złote presety, karta zaliczone/następne, Dalej.
 */
export function RestBreakScreen({
  open,
  remaining,
  durationTotal,
  title,
  elapsedSeconds,
  setsDone,
  setsTotal,
  completedLine,
  nextLabel,
  nextValue,
  coachTip,
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
  const continueRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setRememberPreset(readRestTimerPrefs().defaultSeconds);
    dismissMobileKeyboard();
    const t = window.setTimeout(() => {
      dismissMobileKeyboard();
      continueRef.current?.focus({ preventScroll: true });
    }, 50);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open || !mounted) return null;

  const activePreset = PRESETS_SEC.includes(remaining as (typeof PRESETS_SEC)[number])
    ? remaining
    : PRESETS_SEC.reduce((best, p) =>
        Math.abs(p - remaining) < Math.abs(best - remaining) ? p : best,
      );

  const progress =
    setsTotal > 0 ? Math.min(1, Math.max(0, setsDone / setsTotal)) : 0;

  const ringTotal = Math.max(durationTotal, remaining, 1);

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

      <SessionChromeHeader
        title={title}
        subtitle={`${formatMmSs(elapsedSeconds)} · ${setsDone}/${setsTotal} serii`}
        onClose={onCloseSession}
        onOpenList={onOpenList}
      />

      <SessionProgressBar progress={progress} className="relative" />

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-5">
        <p className="mb-5 text-[12px] font-semibold uppercase tracking-[0.28em] text-[var(--gym-gold)]">
          Przerwa
        </p>

        <RestCountdownClock remaining={remaining} totalSeconds={ringTotal} />

        <div className="mt-8 flex items-center justify-center gap-2.5 sm:gap-3">
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
        {coachTip ? (
          <p className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2.5 text-[13px] leading-snug text-emerald-100/90">
            <span aria-hidden>🔥 </span>
            {coachTip}
          </p>
        ) : null}
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
          ref={continueRef}
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
