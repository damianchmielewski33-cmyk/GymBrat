"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BRAND_GOLD, BRAND_GOLD_BRIGHT, BRAND_GOLD_DEEP } from "@/lib/brand-colors";
import { Button } from "@/components/ui/button";
import { InlineBanner } from "@/components/ui/inline-banner";
import { cn } from "@/lib/utils";

const SESSION_KEY = "gymbrat:entry-loader-seen";
const MIN_VISIBLE_MS = 1100;
const TIMEOUT_MS = 12_000;

const STEPS = [
  "Uruchamiam aplikację",
  "Wczytuję czcionki i grafikę",
  "Łączę z serwerem",
  "Sprawdzam aktualizacje",
] as const;

const HEADLINES = [
  "Rozgrzewka przed treningiem",
  "Dokładamy ciężar…",
  "Prawie gotowe…",
  "Ostatnia seria…",
  "Gotowe. Do roboty!",
] as const;

/** Pary talerzy: [x lewy, x prawy, szerokość, wysokość]. */
const PLATES = [
  [104, 184, 12, 50],
  [90, 197, 13, 70],
  [75, 211, 14, 90],
  [58, 226, 16, 106],
] as const;

type Phase = "idle" | "loading" | "error" | "done";

function shouldShow(): boolean {
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return false;
  } catch {
    /* tryb prywatny — pokaż */
  }
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || window.matchMedia("(max-width: 767px)").matches;
}

function markSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignoruj */
  }
}

function Barbell({ progress, reduced }: { progress: number; reduced: boolean }) {
  return (
    <svg viewBox="0 0 300 150" width="280" height="140" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gb-entry-bar" x1="0" y1="0" x2="300" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor={BRAND_GOLD_DEEP} />
          <stop offset="0.5" stopColor={BRAND_GOLD_BRIGHT} />
          <stop offset="1" stopColor={BRAND_GOLD_DEEP} />
        </linearGradient>
        <linearGradient id="gb-entry-plate" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor={BRAND_GOLD_BRIGHT} />
          <stop offset="0.5" stopColor={BRAND_GOLD} />
          <stop offset="1" stopColor={BRAND_GOLD_DEEP} />
        </linearGradient>
      </defs>
      <rect x="10" y="71" width="280" height="8" rx="3" fill="url(#gb-entry-bar)" />
      <rect x="4" y="64" width="12" height="22" rx="3" fill={BRAND_GOLD_BRIGHT} />
      <rect x="284" y="64" width="12" height="22" rx="3" fill={BRAND_GOLD_BRIGHT} />
      <rect x="116" y="57" width="8" height="36" rx="2" fill="#2e2e33" />
      <rect x="176" y="57" width="8" height="36" rx="2" fill="#2e2e33" />
      {PLATES.map(([xl, xr, w, h], i) => {
        const on = progress > i;
        const y = 75 - h / 2;
        return (
          <g key={i}>
            <motion.rect
              x={xl}
              y={y}
              width={w}
              height={h}
              rx={3}
              fill="url(#gb-entry-plate)"
              initial={false}
              animate={{ opacity: on ? 1 : 0, x: on ? 0 : -24 }}
              transition={reduced ? { duration: 0 } : { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            />
            <motion.rect
              x={xr}
              y={y}
              width={w}
              height={h}
              rx={3}
              fill="url(#gb-entry-plate)"
              initial={false}
              animate={{ opacity: on ? 1 : 0, x: on ? 0 : 24 }}
              transition={reduced ? { duration: 0 } : { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Dynamiczny loader wejścia do aplikacji (PWA / telefon). Postęp opiera się na realnych
 * etapach startu: hydratacja, czcionki, odpowiedź serwera, załadowanie strony.
 * Pokazuje się raz na sesję przeglądarki; po 12 s bez odpowiedzi — stan błędu z ponowieniem.
 */
export function AppEntryLoader() {
  // Serwer renderuje overlay widoczny tylko na mobile (md:hidden), by uniknąć błysku treści.
  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState(0);
  const reduced = useReducedMotion() ?? false;
  const startedAt = useRef(0);
  const [attempt, setAttempt] = useState(0);

  const finish = useCallback(() => {
    markSeen();
    setPhase("done");
  }, []);

  useEffect(() => {
    if (attempt === 0 && !shouldShow()) {
      setPhase("done");
      return;
    }
    let cancelled = false;
    startedAt.current = Date.now();
    setPhase("loading");
    setProgress(1); // hydratacja zakończona

    const ctrl = new AbortController();
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      ctrl.abort();
      // Wolny serwer to nie brak sieci — błąd tylko offline, w innym razie wpuszczamy do aplikacji.
      if (navigator.onLine === false) setPhase("error");
      else finish();
    }, TIMEOUT_MS);

    const fonts = (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (!cancelled) setProgress((p) => Math.max(p, 2));
    });
    // Manifest jest zasobem pobocznym — jego chwilowa awaria nie może blokować startu.
    const server = fetch("/api/branding/manifest", { signal: ctrl.signal })
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) setProgress((p) => Math.max(p, 3));
      });
    const loaded = new Promise<void>((resolve) => {
      if (document.readyState === "complete") resolve();
      else window.addEventListener("load", () => resolve(), { once: true });
    }).then(() => {
      if (!cancelled) setProgress((p) => Math.max(p, 3));
    });

    Promise.all([fonts, server, loaded])
      .then(() => {
        if (cancelled) return;
        setProgress(4);
        const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt.current));
        window.setTimeout(() => {
          if (cancelled) return;
          setProgress(5);
          window.setTimeout(() => !cancelled && finish(), reduced ? 0 : 450);
        }, wait);
      })
      .catch(() => {
        if (cancelled) return;
        if (navigator.onLine === false) setPhase("error");
        else finish();
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      ctrl.abort();
    };
  }, [attempt, finish, reduced]);

  const percent = Math.min(100, progress * 20);
  const label = progress >= 5 ? "Gotowe" : (STEPS[Math.min(progress, 4) - 1] ?? STEPS[0]);

  return (
    <AnimatePresence>
      {phase !== "done" ? (
        <motion.div
          key="entry-loader"
          className="fixed inset-0 z-[100] flex flex-col items-center bg-[var(--gym-black)] px-7 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(6rem,env(safe-area-inset-top))] md:hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.35 }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[18%] size-[340px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(var(--neon-rgb),0.28),transparent_70%)]"
          />

          {phase === "error" ? (
            <Barbell progress={2} reduced />
          ) : (
            <div className="relative">
              <motion.div
                animate={reduced ? undefined : { y: [6, -10, 6], rotate: [-2, 2, -2] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <Barbell progress={progress} reduced={reduced} />
              </motion.div>
            </div>
          )}

          <p className="mt-6 font-display text-5xl uppercase leading-none tracking-[0.14em] text-[var(--gym-gold-bright)]">
            GymBrat
          </p>

          {phase === "error" ? (
            <div className="mt-8 flex w-full max-w-sm flex-col gap-4">
              <InlineBanner variant="error" role="alert">
                Nie udało się wczytać aplikacji. Sprawdź połączenie z internetem i spróbuj
                ponownie.
              </InlineBanner>
              <Button variant="cta" onClick={() => setAttempt((a) => a + 1)}>
                Spróbuj ponownie
              </Button>
              <Button variant="outline" size="lg" onClick={finish}>
                Kontynuuj mimo to
              </Button>
            </div>
          ) : (
            <div className="mt-8 flex w-full max-w-sm flex-col" role="status" aria-live="polite">
              <p className="text-center text-sm text-white/60">
                {HEADLINES[Math.min(progress, 4)]}
              </p>
              <div className="mt-8 flex items-baseline justify-between">
                <span className="text-[13px] text-white/60">{label}</span>
                <span className="font-metric text-2xl tabular-nums text-[var(--gym-gold-bright)]">
                  {percent}%
                </span>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label="Postęp ładowania aplikacji"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--gym-gold-deep)] to-[var(--gym-gold-bright)] transition-[width] duration-500 ease-out"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <ul className="mt-6 flex flex-col gap-1.5">
                {STEPS.map((text, i) => {
                  const done = progress > i + 1 || progress >= 5;
                  const active = progress === i + 1;
                  return (
                    <li
                      key={text}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-2xl border px-3.5 text-sm transition-colors",
                        active
                          ? "border-[rgba(var(--neon-rgb),0.45)] bg-[rgba(var(--neon-rgb),0.10)] font-semibold text-white/90"
                          : "border-white/10 bg-white/[0.04] text-white/60",
                        done && "text-white/90",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px]",
                          done
                            ? "border-[var(--gym-gold-bright)] bg-[var(--gym-gold-bright)] text-[var(--gym-on-gold)]"
                            : active
                              ? "border-[var(--gym-gold)]"
                              : "border-white/25",
                        )}
                      >
                        {done ? (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6.4l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : active ? (
                          <span className="size-2 animate-pulse rounded-full bg-[var(--gym-gold-bright)]" />
                        ) : null}
                      </span>
                      {text}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
