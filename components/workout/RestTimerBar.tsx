"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Timer, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PlateCalculatorSheet } from "@/components/workout/plate-calculator-sheet";
import {
  readRestTimerPrefs,
  writeRestAutoStart,
  writeRestDefaultSeconds,
} from "@/lib/rest-timer-prefs";
import { cn } from "@/lib/utils";

const PRESETS_SEC = [45, 60, 90, 120, 180] as const;
const DEFAULT_OPTIONS_SEC = [45, 60, 90, 120, 180] as const;

const REST_PREFS_SERVER = { autoStart: true, defaultSeconds: 90 } as const;

/** Ten sam zakład nie wywołuje `storage` — emitujemy po zapisie, żeby odświeżyć UI. */
const REST_PREFS_CHANGED = "gymbrat:rest-prefs-changed";

function subscribeRestPrefs(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const onStorage = (e: StorageEvent) => {
    if (e.key === "gymbrat:restAutoStart" || e.key === "gymbrat:restDefaultSeconds") {
      onStoreChange();
    }
  };
  const onLocal = () => onStoreChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(REST_PREFS_CHANGED, onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(REST_PREFS_CHANGED, onLocal);
  };
}

type RestTimerPrefs = ReturnType<typeof readRestTimerPrefs>;

/** SSR i pierwszy render klienta bez localStorage — unikamy błędu hydratacji (`console.error`). */
function useRestTimerPrefsFromStorage() {
  const [prefs, setPrefs] = useState<RestTimerPrefs>(() => ({ ...REST_PREFS_SERVER }));

  useEffect(() => {
    setPrefs(readRestTimerPrefs());
    return subscribeRestPrefs(() => setPrefs(readRestTimerPrefs()));
  }, []);

  return prefs;
}

type RestTimerBarProps = {
  /** Pozostały czas w sekundach lub null gdy wyłączony */
  remaining: number | null;
  onStart: (seconds: number) => void;
  onStop: () => void;
};

/**
 * Pasek odpoczynku między seriami — presety jak w typowych dziennikach (GymPad / Hevy).
 */
export function RestTimerBar({ remaining, onStart, onStop }: RestTimerBarProps) {
  const active = remaining !== null && remaining > 0;
  const mm = active ? String(Math.floor(remaining / 60)).padStart(2, "0") : "00";
  const ss = active ? String(remaining % 60).padStart(2, "0") : "00";

  const { autoStart, defaultSeconds: defaultSec } = useRestTimerPrefsFromStorage();

  function toggleAuto() {
    const next = !autoStart;
    writeRestAutoStart(next);
    window.dispatchEvent(new Event(REST_PREFS_CHANGED));
  }

  function pickDefault(sec: number) {
    writeRestDefaultSeconds(sec);
    window.dispatchEvent(new Event(REST_PREFS_CHANGED));
  }

  return (
    <div className="sticky top-16 z-[45] border-b border-white/[0.06] bg-[#111]/92 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-y-2 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-white/80">
            <Timer className="h-4 w-4 shrink-0 text-[#3B82F6]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
              Odpoczynek
            </span>
          </div>
          <PlateCalculatorSheet />
        </div>

        <AnimatePresence mode="wait">
          {active ? (
            <motion.div
              key="run"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3"
            >
              <span className="font-mono text-lg font-semibold tabular-nums text-white sm:text-xl">
                {mm}:{ss}
              </span>
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={onStop}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-white/70 hover:bg-white/[0.12]"
                aria-label="Zatrzymaj timer"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-end gap-2 sm:flex-row sm:flex-wrap sm:items-center"
            >
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {PRESETS_SEC.map((s) => (
                  <motion.button
                    key={s}
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onStart(s)}
                    className="rounded-full border border-white/[0.1] bg-[#1e1e1e] px-3 py-1.5 text-[11px] font-semibold text-white/85 hover:bg-[#262626]"
                  >
                    {s}s
                  </motion.button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] pt-2 sm:border-t-0 sm:pt-0">
                <button
                  type="button"
                  onClick={toggleAuto}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition",
                    autoStart
                      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-100"
                      : "border-white/10 bg-white/[0.04] text-white/50",
                  )}
                >
                  Auto po serii: {autoStart ? "wł." : "wył."}
                </button>
                <span className="text-[10px] text-white/35">Domyślnie</span>
                <div className="flex flex-wrap gap-1">
                  {DEFAULT_OPTIONS_SEC.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => pickDefault(s)}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                        defaultSec === s
                          ? "bg-[var(--neon)]/25 text-white ring-1 ring-[var(--neon)]/40"
                          : "bg-white/[0.06] text-white/55 hover:bg-white/[0.1]",
                      )}
                    >
                      {s}s
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
