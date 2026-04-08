"use client";

import { motion } from "framer-motion";
import { Dumbbell, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type WorkoutCardProps = {
  dayLabel: string;
  title: string;
  exercises: Array<{ id: string; name: string }>;
  onChangeTitle: (title: string) => void;
  onAddExercise: () => void;
  onRemoveExercise: (exerciseId: string) => void;
};

export function WorkoutCard({
  dayLabel,
  title,
  exercises,
  onChangeTitle,
  onAddExercise,
  onRemoveExercise,
}: WorkoutCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="glass-panel group relative overflow-hidden p-6"
    >
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(120deg,rgba(255,255,255,0.10),transparent_55%),radial-gradient(540px_260px_at_10%_10%,rgba(255,45,85,0.16),transparent_60%)]" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
              {dayLabel}
            </p>
            <input
              value={title}
              onChange={(e) => onChangeTitle(e.target.value)}
              className="font-heading mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-base font-semibold text-white/90 outline-none ring-[var(--neon)]/30 focus:ring-2"
              placeholder="Nazwa treningu"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2 text-white/60">
            <Dumbbell className="h-4 w-4 text-[var(--neon)]" />
            <Dumbbell className="h-4 w-4 opacity-70" />
          </div>
        </div>

        <div className="mt-5 space-y-2">
          {exercises.length === 0 ? (
            <p className="text-sm text-white/55">
              Brak ćwiczeń — dodaj przykładowe.
            </p>
          ) : (
            exercises.map((ex) => (
              <motion.div
                key={ex.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Dumbbell className="h-4 w-4 shrink-0 text-white/50" />
                  <span className="truncate text-sm text-white/80">
                    {ex.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveExercise(ex.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-white/60 transition hover:border-white/20 hover:text-white"
                  aria-label="Usuń ćwiczenie"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            ))
          )}
        </div>

        <div className="mt-5">
          <Button type="button" variant="outline" onClick={onAddExercise}>
            <Plus className="mr-2 h-4 w-4" />
            Dodaj ćwiczenie
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

