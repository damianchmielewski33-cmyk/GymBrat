"use client";

import { motion } from "framer-motion";

type PlanProgressHeaderProps = {
  /** Ukończone serie (done) */
  done: number;
  /** Łączna liczba serii w aktywnym planie */
  total: number;
  /** Nazwa treningu / planu do podglądu */
  title: string;
};

/**
 * Pasek postępu wykonania wczytanego planu — procent ukończonych serii.
 */
export function PlanProgressHeader({ done, total, title }: PlanProgressHeaderProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="sticky top-0 z-[45] mb-4 w-full border-b border-white/[0.08] bg-[#0f0f0f]/95 px-4 pb-3 pt-2 backdrop-blur-md sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
            Postęp planu
          </p>
          <p className="mt-0.5 truncate text-[13px] font-medium text-white/85" title={title}>
            {title.trim() || "Trening"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-xl font-bold tabular-nums text-[#34D399]">{pct}%</p>
          <p className="text-[10px] text-white/45">
            {done}/{total} {total === 1 ? "seria" : "serii"}
          </p>
        </div>
      </div>
      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/[0.08]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#22c55e]/90 to-[#34d399]"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
        />
      </div>
    </div>
  );
}
