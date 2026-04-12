"use client";

import { motion } from "framer-motion";
import { Calendar, ChevronRight, Play } from "lucide-react";
import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import { cn } from "@/lib/utils";

type WorkoutPlanCardProps = {
  row: WorkoutPlanWithLastWorkoutDTO;
  index: number;
  active: boolean;
  empty: boolean;
  lastActivityLabel: string;
  onStart: () => void;
  startLabel: string;
};

/**
 * Lista planów w stylu GymPad: jeden wiersz, kolorowa kropka, meta, strzałka.
 */
export function WorkoutPlanCard({
  row,
  index,
  active,
  empty,
  lastActivityLabel,
  onStart,
  startLabel,
}: WorkoutPlanCardProps) {
  const n = row.plan.exercises.length;
  const name = row.plan.planName.trim() || "Bez nazwy";

  let hue = 0;
  for (let i = 0; i < row.id.length; i++) hue = (hue + row.id.charCodeAt(i) * (i + 1)) % 360;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1], delay: index * 0.04 }}
    >
      <button
        type="button"
        disabled={empty}
        onClick={onStart}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
          active
            ? "border-[#3B82F6]/50 bg-[#1a2332]"
            : "border-white/[0.06] bg-[#1a1a1a] hover:border-white/[0.10] hover:bg-[#1e1e1e]",
          empty && "cursor-not-allowed opacity-50",
        )}
      >
        <div
          className="h-10 w-10 shrink-0 rounded-full"
          style={{
            background: `linear-gradient(135deg, hsla(${hue}, 70%, 55%, 0.55), hsla(${(hue + 40) % 360}, 60%, 40%, 0.35))`,
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">{name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/40">
            <Calendar className="h-3 w-3 shrink-0" />
            <span className="truncate">{lastActivityLabel}</span>
            <span className="text-white/25">·</span>
            <span>{n} ćw.</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="hidden rounded-full bg-[#FF1A4B] px-2.5 py-1 text-[11px] font-semibold text-white sm:inline">
            {startLabel}
          </span>
          {empty ? null : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70">
              <Play className="h-4 w-4 fill-current" />
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-white/25" />
        </div>
      </button>
      {empty ? (
        <p className="mt-1.5 px-1 text-[11px] text-amber-200/80">Dodaj ćwiczenia w planie.</p>
      ) : null}
    </motion.div>
  );
}
