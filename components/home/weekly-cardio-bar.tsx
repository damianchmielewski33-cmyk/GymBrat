"use client";

import { motion } from "framer-motion";
import { Flame } from "lucide-react";

type Props = {
  percent: number;
  minutesCompleted: number;
  weeklyGoal: number;
};

export function WeeklyCardioBar({
  percent,
  minutesCompleted,
  weeklyGoal,
}: Props) {
  const safe = Math.min(100, Math.max(0, percent));

  return (
    <div className="glass-panel neon-glow relative overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--neon)]/10 via-transparent to-transparent" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
            Cardio w tygodniu
          </p>
          <h2 className="font-heading mt-1 text-2xl font-semibold tracking-tight">
            {safe.toFixed(1)}% celu
          </h2>
          <p className="mt-2 text-sm text-white/70">
            <span className="font-semibold text-white">
              {minutesCompleted} min
            </span>{" "}
            / {weeklyGoal} min (cel)
          </p>
          <p className="mt-1 text-xs text-white/50">
            Krocząca suma 7 dni minut cardio z zapisanych sesji.
          </p>
        </div>
        <motion.div
          initial={{ scale: 0.9, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5"
        >
          <Flame className="h-6 w-6 text-[var(--neon)]" />
        </motion.div>
      </div>
      <div className="relative mt-6 h-3 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#ff4d6d] via-[#ff2d55] to-[#ff7aa1]"
          initial={{ width: 0 }}
          animate={{ width: `${safe}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
