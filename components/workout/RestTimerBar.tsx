"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Timer, X } from "lucide-react";

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

  return (
    <div className="sticky top-16 z-[45] border-b border-white/[0.06] bg-[#111]/92 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2 text-white/80">
          <Timer className="h-4 w-4 text-[#3B82F6]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
            Odpoczynek
          </span>
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
              className="flex flex-wrap items-center gap-1.5"
            >
              {([60, 90, 120] as const).map((s) => (
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
