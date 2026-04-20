"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type PlanProgressHeaderProps = {
  /** Ukończone serie (done) */
  done: number;
  /** Łączna liczba serii w aktywnym planie */
  total: number;
  /** Nazwa treningu / planu do podglądu */
  title: string;
  /** Opcjonalne akcje (np. menu/sheet z ustawieniami sesji) */
  actionsSlot?: ReactNode;
};

/**
 * Pasek postępu wykonania wczytanego planu — procent ukończonych serii.
 */
export function PlanProgressHeader({ done, total, title, actionsSlot }: PlanProgressHeaderProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="sticky top-0 z-[50] w-full border-b border-white/[0.08] bg-[#0f0f0f]/92 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-white/90" title={title}>
            {title.trim() || "Trening"}
          </p>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">
            Postęp: {done}/{total} {total === 1 ? "seria" : "serii"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <p className="font-mono text-lg font-bold tabular-nums text-[#34D399]">{pct}%</p>
            <p className="text-[10px] text-white/45">ukończone</p>
          </div>
          {/** slot na akcje (np. sheet) */}
          <div className="shrink-0">{actionsSlot ?? null}</div>
        </div>
      </div>

      <div className="h-1 w-full bg-white/[0.08]">
        <motion.div
          className="h-full bg-gradient-to-r from-[#22c55e]/90 to-[#34d399]"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
        />
      </div>
    </div>
  );
}
