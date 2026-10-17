"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { List, Play, Volume2, VolumeX, X } from "lucide-react";
import { hapticTap } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { writeRestDefaultSeconds } from "@/lib/rest-timer-prefs";
import type { LiveCoachTip } from "@/lib/live-set-coach";
import { formatKgPl } from "@/lib/set-progression-suggestion";

/** Palette premium — lokalnie na ekranie przerwy (brief). */
const GOLD = "#DDBB6D";
const GOLD_SOFT = "rgba(221,187,109,0.35)";
const GOLD_GLOW = "rgba(221,187,109,0.45)";

const PRESETS: Array<{ sec: number; label: string }> = [
  { sec: 60, label: "60s" },
  { sec: 90, label: "90s" },
  { sec: 120, label: "2 min" },
  { sec: 180, label: "3 min" },
];

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

function formatMmSs(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Płynne odliczanie 60 fps między tickami sekundowymi. */
function useSmoothRemaining(remaining: number, open: boolean) {
  const [smooth, setSmooth] = useState(remaining);
  const tickFromRef = useRef(remaining);
  const tickAtRef = useRef(
    typeof performance !== "undefined" ? performance.now() : 0,
  );

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

function PremiumTimerRing({
  remaining,
  totalSeconds,
}: {
  remaining: number;
  totalSeconds: number;
}) {
  const smooth = useSmoothRemaining(remaining, true);
  const total = Math.max(1, totalSeconds);
  const ratio = Math.min(1, Math.max(0, smooth / total));
  const urgent = remaining <= 10;

  // SVG viewBox; CSS size ≈ 45–50% wysokości ekranu
  const size = 320;
  const stroke = 4;
  const r = (size - stroke) / 2 - 6;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - ratio);

  return (
    <div
      className="relative mx-auto flex items-center justify-center"
      style={{
        width: "min(78vw, 46dvh, 340px)",
        height: "min(78vw, 46dvh, 340px)",
      }}
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`Pozostało ${formatMmSs(remaining)}`}
    >
      {/* Radial luxury glow */}
      <div
        className="pointer-events-none absolute inset-[-12%] rounded-full"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${GOLD_SOFT} 0%, transparent 62%)`,
          animation: urgent
            ? "rest-ring-pulse 1.1s ease-in-out infinite"
            : "rest-ring-pulse 2.8s ease-in-out infinite",
        }}
        aria-hidden
      />

      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 h-full w-full -rotate-90"
        aria-hidden
      >
        <defs>
          <filter id="rest-gold-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="rest-gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F0D58A" />
            <stop offset="45%" stopColor={GOLD} />
            <stop offset="100%" stopColor="#A8893F" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#rest-gold-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
          filter="url(#rest-gold-glow)"
          style={{
            transition: "stroke-dashoffset 80ms linear",
          }}
        />
      </svg>

      <div className="relative z-[1] flex flex-col items-center justify-center px-4 text-center">
        <p
          className="font-display leading-none tabular-nums tracking-tight"
          style={{
            fontSize: "clamp(5rem, 22vw, 7.5rem)",
            color: GOLD,
            textShadow: urgent
              ? `0 0 40px ${GOLD_GLOW}, 0 0 80px rgba(221,187,109,0.25)`
              : `0 0 48px rgba(221,187,109,0.28)`,
          }}
        >
          {formatMmSs(remaining)}
        </p>
      </div>
    </div>
  );
}

export type RestNextSetInfo = {
  /** np. „Seria 2 z 2” */
  setLine: string;
  /** np. „2s 10–12” */
  schemeLine: string | null;
  /** np. „RIR 1” */
  rirLine: string | null;
  /** Cel: 75 kg × 11 */
  targetLine: string | null;
};

export type RestBreakScreenProps = {
  open: boolean;
  remaining: number;
  durationTotal: number;
  /** Tytuł sesji w headerze (np. „Pull”). */
  title: string;
  /** Nazwa ćwiczenia pod timerem (np. „Teres Pulldown”). */
  exerciseLabel: string;
  elapsedSeconds: number;
  setsDone: number;
  setsTotal: number;
  exercisesDone: number;
  exercisesTotal: number;
  completedWeightKg: number | null;
  completedReps: number | null;
  nextSet: RestNextSetInfo | null;
  coachTip: LiveCoachTip | null;
  soundOn: boolean;
  onToggleSound: () => void;
  onAddSeconds: (sec: number) => void;
  onSetSeconds: (sec: number) => void;
  onContinue: () => void;
  onCloseSession?: () => void;
  onOpenList?: () => void;
};

/**
 * Pełnoekranowa przerwa — premium timer (Apple Fitness+ / Whoop aesthetic).
 */
export function RestBreakScreen({
  open,
  remaining,
  durationTotal,
  title,
  exerciseLabel,
  elapsedSeconds,
  setsDone,
  setsTotal,
  exercisesDone,
  exercisesTotal,
  completedWeightKg,
  completedReps,
  nextSet,
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
  const continueRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    dismissMobileKeyboard();
    const t = window.setTimeout(() => {
      dismissMobileKeyboard();
      continueRef.current?.focus({ preventScroll: true });
    }, 50);
    return () => window.clearTimeout(t);
  }, [open]);

  const activePreset = useMemo(
    () => PRESETS.find((p) => p.sec === remaining)?.sec ?? null,
    [remaining],
  );

  const progress =
    setsTotal > 0 ? Math.min(1, Math.max(0, setsDone / setsTotal)) : 0;
  const ringTotal = Math.max(durationTotal, remaining, 1);

  const completedLine =
    completedWeightKg != null &&
    completedReps != null &&
    completedReps > 0
      ? `${completedWeightKg} kg × ${completedReps}`
      : null;

  const coachPraise = coachTip
    ? coachTip.tone === "caution"
      ? "Uwaga."
      : coachTip.tone === "hold"
        ? "Trzymaj."
        : "Świetnie."
    : null;
  const coachAction = coachTip
    ? coachTip.apply
      ? `Powtórz ${formatKgPl(coachTip.apply.weightKg)} kg i utrzymaj technikę.`
      : coachTip.decision || coachTip.body
    : null;

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex flex-col text-white"
      style={{ background: "#000000" }}
    >
      <style>{`
        @keyframes rest-ring-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.03); }
        }
      `}</style>

      {/* Ambient gold wash — ultra subtle */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 22%, rgba(221,187,109,0.12), transparent 70%)",
        }}
        aria-hidden
      />

      {/* HEADER */}
      <header className="relative z-[2] shrink-0 px-4 pt-[max(0.75rem,calc(env(safe-area-inset-top,0px)+0.35rem))]">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              hapticTap();
              onCloseSession?.();
            }}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.03] text-white/80 transition hover:border-[rgba(221,187,109,0.4)] hover:bg-white/[0.06]"
            aria-label="Zamknij sesję"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>

          <div className="min-w-0 flex-1 pt-1 text-center">
            <p className="truncate text-[15px] font-semibold tracking-tight text-white">
              {title || "Trening"}
            </p>
            <p className="mt-1 text-[12px] tabular-nums leading-snug text-white/45">
              {formatMmSs(elapsedSeconds)}
              <span className="text-white/20"> · </span>
              {setsDone}/{setsTotal} serii
              <span className="text-white/20"> · </span>
              {exercisesDone}/{exercisesTotal} ćw.
            </p>
          </div>

          {onOpenList ? (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onOpenList();
              }}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.03] text-white/80 transition hover:border-[rgba(221,187,109,0.4)] hover:bg-white/[0.06]"
              aria-label="Lista ćwiczeń"
            >
              <List className="h-4 w-4" strokeWidth={1.75} />
            </button>
          ) : (
            <span className="inline-flex h-12 w-12 shrink-0" aria-hidden />
          )}
        </div>

        <div
          className="mt-3 h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06]"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{
              width: `${Math.round(progress * 100)}%`,
              background: `linear-gradient(90deg, #A8893F, ${GOLD}, #F0D58A)`,
              boxShadow: `0 0 12px ${GOLD_GLOW}`,
            }}
          />
        </div>
      </header>

      {/* SCROLLABLE BODY */}
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        {/* HERO TIMER ~45–50% */}
        <section className="flex min-h-[min(48dvh,420px)] flex-col items-center justify-center px-5 pb-2 pt-4 sm:pt-6">
          <PremiumTimerRing remaining={remaining} totalSeconds={ringTotal} />

          <p
            className="mt-5 max-w-[90%] truncate text-center text-[11px] font-semibold uppercase text-white/50"
            style={{ letterSpacing: "0.28em" }}
          >
            Przerwa
            {exerciseLabel ? (
              <>
                <span className="text-white/25"> · </span>
                <span style={{ color: GOLD }}>{exerciseLabel}</span>
              </>
            ) : null}
          </p>

          {/* Sound pill */}
          <button
            type="button"
            onClick={() => {
              hapticTap();
              onToggleSound();
            }}
            className={cn(
              "mt-5 inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[12px] font-semibold transition",
              soundOn
                ? "border-[rgba(221,187,109,0.35)] bg-[rgba(221,187,109,0.1)] text-[rgba(240,213,138,0.95)]"
                : "border-white/12 bg-white/[0.03] text-white/40",
            )}
            aria-label={soundOn ? "Wycisz sygnał" : "Włącz sygnał"}
          >
            {soundOn ? (
              <Volume2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <VolumeX className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            Dźwięk
          </button>
        </section>

        {/* NEXT SET CARD */}
        <section className="mx-5 mt-4 rounded-[22px] border border-white/[0.08] bg-[#0A0A0A] px-5 py-4 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
          <p
            className="text-[10px] font-semibold uppercase text-white/35"
            style={{ letterSpacing: "0.2em" }}
          >
            Następna seria
          </p>
          {nextSet ? (
            <>
              <p className="mt-2 text-[22px] font-semibold tracking-tight text-white">
                {nextSet.setLine}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-white/50">
                {nextSet.schemeLine ? <span>{nextSet.schemeLine}</span> : null}
                {nextSet.rirLine ? <span>{nextSet.rirLine}</span> : null}
              </div>
              {nextSet.targetLine ? (
                <p className="mt-3 text-[15px] font-semibold" style={{ color: GOLD }}>
                  <span aria-hidden>🎯 </span>
                  Cel: {nextSet.targetLine}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-[18px] font-semibold text-white/70">
              Koniec treningu
            </p>
          )}

          {completedLine ? (
            <>
              <div className="my-4 h-px bg-white/[0.07]" />
              <p className="text-[12px] text-white/40">
                <span className="text-emerald-400/90" aria-hidden>
                  ✓{" "}
                </span>
                Zaliczone
              </p>
              <p className="mt-1 font-metric text-[20px] tabular-nums text-white/90">
                {completedLine}
              </p>
            </>
          ) : null}
        </section>

        {/* QUICK PRESETS */}
        <section className="mx-5 mt-5 grid grid-cols-4 gap-2.5">
          {PRESETS.map((p) => {
            const active = activePreset === p.sec;
            return (
              <button
                key={p.sec}
                type="button"
                onClick={() => {
                  hapticTap();
                  onSetSeconds(p.sec);
                  writeRestDefaultSeconds(p.sec);
                }}
                className={cn(
                  "inline-flex h-12 items-center justify-center rounded-full text-[13px] font-bold tabular-nums transition active:scale-[0.97]",
                  active
                    ? "text-black"
                    : "border bg-transparent text-white/70 hover:text-white",
                )}
                style={
                  active
                    ? {
                        background: `linear-gradient(180deg, #F0D58A 0%, ${GOLD} 55%, #A8893F 100%)`,
                        boxShadow: `0 0 24px ${GOLD_GLOW}`,
                      }
                    : {
                        borderColor: "rgba(221,187,109,0.35)",
                      }
                }
              >
                {p.label}
              </button>
            );
          })}
        </section>

        {/* AI COACH — zwięźle po polsku */}
        {coachTip && coachPraise && coachAction ? (
          <section className="mx-5 mt-5 mb-2 rounded-[18px] border border-[rgba(221,187,109,0.18)] bg-[rgba(221,187,109,0.06)] px-4 py-3.5">
            <p className="text-[14px] font-semibold leading-snug text-white/95">
              <span aria-hidden>🔥 </span>
              {coachPraise} {coachAction}
            </p>
          </section>
        ) : (
          <div className="mb-2" />
        )}
      </div>

      {/* BOTTOM CTA */}
      <div className="relative z-[2] shrink-0 border-t border-white/[0.06] bg-black/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              hapticTap();
              onAddSeconds(30);
            }}
            className="inline-flex h-[72px] w-[4.75rem] shrink-0 items-center justify-center rounded-[22px] border border-white/12 bg-[#0A0A0A] text-[14px] font-bold text-white/80 transition hover:border-[rgba(221,187,109,0.35)] hover:text-white"
          >
            +30 s
          </button>
          <button
            ref={continueRef}
            type="button"
            onClick={() => {
              hapticTap();
              if (PRESETS.some((p) => p.sec === remaining)) {
                writeRestDefaultSeconds(remaining);
              }
              onContinue();
            }}
            className="inline-flex h-[72px] min-w-0 flex-1 items-center justify-center gap-2.5 rounded-[26px] text-[17px] font-bold uppercase tracking-[0.06em] text-black transition active:scale-[0.99]"
            style={{
              background: `linear-gradient(180deg, #F0D58A 0%, ${GOLD} 48%, #A8893F 100%)`,
              boxShadow: `0 0 36px ${GOLD_GLOW}, 0 12px 32px rgba(0,0,0,0.45)`,
            }}
          >
            <Play className="h-5 w-5 fill-current" strokeWidth={0} />
            Dalej
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
