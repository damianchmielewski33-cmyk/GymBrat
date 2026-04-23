"use client";

import { motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { useEffect, useMemo } from "react";
import { GymPadSetRow } from "@/components/workout/gympad-set-row";
import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";
import {
  exerciseTotalReps,
  exerciseVolume,
  formatVolumeKg,
} from "@/lib/workout-session-calculations";
import type { LastPlanHintsMap } from "@/lib/last-workout-hints";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

function formatHMS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampWeight(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(999, Math.round(n * 2) / 2));
}

function formatLastHintLine(h?: LastPlanHintsMap[string]): string | null {
  if (!h?.sets?.length) return null;
  return h.sets
    .map((s) => {
      const r = s.reps != null ? String(s.reps) : "—";
      const rp = s.rpe != null ? ` RPE${s.rpe}` : "";
      return `${s.weight}×${r}${rp}`;
    })
    .join(" · ");
}

type GymPadSessionLayoutProps = {
  title: string;
  elapsedSeconds: number;
  exercises: WorkoutExerciseState[];
  selectedExerciseId: string | null;
  onSelectExercise: (id: string) => void;
  onPatchSet: (exerciseId: string, setIndex: number, patch: Partial<WorkoutSetState>) => void;
  onAddSet: (exerciseId: string) => void;
  onRemoveLastSet: (exerciseId: string) => void;
  lastHints?: LastPlanHintsMap;
  onExerciseNoteChange?: (exerciseId: string, note: string) => void;
};

/**
 * Główny obszar treningu w stylu GymPad: nagłówek, zakładki ćwiczeń, karty statystyk, lista serii.
 */
export function GymPadSessionLayout({
  title,
  elapsedSeconds,
  exercises,
  selectedExerciseId,
  onSelectExercise,
  onPatchSet,
  onAddSet,
  onRemoveLastSet,
  lastHints,
  onExerciseNoteChange,
}: GymPadSessionLayoutProps) {
  const current = useMemo(
    () => exercises.find((e) => e.id === selectedExerciseId) ?? exercises[0] ?? null,
    [exercises, selectedExerciseId],
  );

  useEffect(() => {
    if (exercises.length === 0) return;
    const ids = new Set(exercises.map((e) => e.id));
    if (!selectedExerciseId || !ids.has(selectedExerciseId)) {
      onSelectExercise(exercises[0]!.id);
    }
  }, [exercises, selectedExerciseId, onSelectExercise]);

  const totalReps = current ? exerciseTotalReps(current.sets) : 0;
  const vol = current ? exerciseVolume(current.sets) : 0;
  const nSets = current?.sets.length ?? 0;
  const lastHintLine =
    current && lastHints ? formatLastHintLine(lastHints[current.id]) : null;

  function applyPatch(setIdx: number, patch: Partial<WorkoutSetState>) {
    if (!current) return;
    const next = { ...patch };
    if (patch.reps !== undefined) {
      next.reps =
        patch.reps === null ? null : clampInt(patch.reps, 0, 999);
    }
    if (patch.weight !== undefined) next.weight = clampWeight(patch.weight);
    // "done" jest wyliczane centralnie (auto po wpisaniu danych) — nie ustawiamy go z UI.
    if ("done" in next) delete (next as Partial<WorkoutSetState>).done;
    onPatchSet(current.id, setIdx, next);
  }

  return (
    <div className="text-white">
      <div className="flex items-end justify-between gap-3 border-b border-white/10 pb-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">
            Sesja
          </p>
          <p className="truncate text-sm font-semibold text-white/85" title={title}>
            {title.trim() || "Trening"}
          </p>
        </div>
        <span className="shrink-0 font-mono text-[26px] font-semibold leading-none tabular-nums text-[var(--neon)] sm:text-3xl">
          {formatHMS(elapsedSeconds)}
        </span>
      </div>

      <div className="mt-3">
        <div className="-mx-1 flex gap-1 overflow-x-auto pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {exercises.map((ex) => {
          const active = ex.id === current?.id;
          return (
            <button
              key={ex.id}
              type="button"
              onClick={() => onSelectExercise(ex.id)}
              className={cn(
                "relative shrink-0 rounded-full px-3 py-2 text-left text-[13px] font-semibold transition",
                active
                  ? "bg-white/[0.08] text-white"
                  : "bg-transparent text-white/45 hover:bg-white/[0.05] hover:text-white/75",
              )}
            >
              {active ? <span className="absolute inset-0 rounded-full ring-1 ring-white/10" /> : null}
              <span className="line-clamp-2 max-w-[200px]">{ex.name}</span>
            </button>
          );
        })}
        </div>
        <div className="mt-3 h-px w-full bg-white/10" />
      </div>

      {current ? (
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="pt-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-4 text-center">
              <p className="text-3xl font-bold tabular-nums text-white">{totalReps}</p>
              <p className="mt-1 text-xs font-medium text-white/55">powt.</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-4 text-center">
              <p className="text-2xl font-bold tabular-nums leading-tight text-white sm:text-3xl">
                {formatVolumeKg(vol).replace(/\s/g, " ")}
              </p>
              <p className="mt-1 text-xs font-medium text-white/55">objętość (kg)</p>
            </div>
          </div>

          <p className="mt-3 text-center text-[12px] text-white/55">
            {nSets} {nSets === 1 ? "seria" : "serii"} • {totalReps} powt. • {formatVolumeKg(vol)} kg
          </p>

          {lastHintLine ? (
            <p className="mt-2 text-center text-[11px] leading-snug text-amber-200/85">
              Ostatnio: {lastHintLine}
            </p>
          ) : null}

          <div className="mt-3">
            {current.sets.map((set, idx) => (
              <GymPadSetRow
                key={`${current.id}-${idx}`}
                setIndex={idx}
                set={set}
                animationIndex={idx}
                onChange={(patch) => applyPatch(idx, patch)}
              />
            ))}
          </div>

          {onExerciseNoteChange ? (
            <div className="mt-4 space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Notatka do ćwiczenia
              </label>
              <Textarea
                value={current.note ?? ""}
                onChange={(e) => onExerciseNoteChange(current.id, e.target.value)}
                placeholder="Technika, martwy punkt, zmiana maszyny…"
                className="min-h-[72px] resize-none rounded-xl border-white/12 bg-white/[0.04] text-sm text-white placeholder:text-white/30"
              />
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-between gap-3">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onAddSet(current.id)}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--neon)] px-5 py-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(230,0,35,0.20)] hover:brightness-110"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
              Dodaj serię
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              disabled={current.sets.length <= 1}
              onClick={() => onRemoveLastSet(current.id)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/[0.06] disabled:opacity-35"
            >
              <Minus className="h-5 w-5" />
              Usuń
            </motion.button>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
