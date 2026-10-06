"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { updateCompletedWorkout } from "@/actions/workout-history";
import { formatExerciseTargetLine } from "@/lib/start-workout-session";
import { formatEditDeadline } from "@/lib/workout-history-overview";
import { cn } from "@/lib/utils";
import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";

export type WorkoutHistoryEditInitial = {
  id: string;
  title: string;
  date: string;
  planOccurrence: number;
  editDeadlineMs: number;
  weekdayLabel: string;
  exercises: WorkoutExerciseState[];
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function SetRow({
  index,
  set,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  set: WorkoutSetState;
  onChange: (patch: Partial<WorkoutSetState>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 shrink-0 text-[12px] font-semibold text-white/40">
        S{index + 1}
      </span>
      <input
        inputMode="decimal"
        value={set.weight > 0 ? String(set.weight) : ""}
        onChange={(e) => {
          const raw = e.target.value.replace(",", ".").trim();
          const n = raw === "" ? 0 : Number(raw);
          onChange({ weight: Number.isFinite(n) ? Math.max(0, n) : 0 });
        }}
        placeholder="0"
        className="h-11 w-[72px] rounded-xl border border-white/12 bg-black/40 px-2 text-center font-metric text-[16px] text-white outline-none focus:border-[var(--gym-gold)]/50"
        aria-label={`Ciężar seria ${index + 1}`}
      />
      <span className="text-white/35">×</span>
      <input
        inputMode="numeric"
        value={set.reps != null ? String(set.reps) : ""}
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (raw === "") {
            onChange({ reps: null });
            return;
          }
          const n = Number(raw);
          onChange({
            reps: Number.isFinite(n) ? Math.max(0, Math.round(n)) : null,
          });
        }}
        placeholder="0"
        className="h-11 w-[64px] rounded-xl border border-white/12 bg-black/40 px-2 text-center font-metric text-[16px] text-white outline-none focus:border-[var(--gym-gold)]/50"
        aria-label={`Powtórzenia seria ${index + 1}`}
      />
      <button
        type="button"
        onClick={() => {
          const cur = set.rir ?? 1;
          const next = cur >= 3 ? 0 : cur + 1;
          onChange({ rir: next });
        }}
        className={cn(
          "h-11 shrink-0 rounded-xl border px-3 text-[11px] font-semibold uppercase tracking-wide",
          set.rir != null
            ? "border-[var(--gym-gold)]/40 text-[var(--gym-gold)]"
            : "border-white/12 text-white/45",
        )}
      >
        RIR{set.rir != null ? ` ${set.rir}` : ""}
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/40 disabled:opacity-30"
        aria-label="Usuń serię"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function WorkoutHistoryEditClient({
  initial,
}: {
  initial: WorkoutHistoryEditInitial;
}) {
  const router = useRouter();
  const [exercises, setExercises] = useState(initial.exercises);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const deadlineLabel = useMemo(
    () => formatEditDeadline(initial.editDeadlineMs),
    [initial.editDeadlineMs],
  );

  function updateSet(
    exId: string,
    setIndex: number,
    patch: Partial<WorkoutSetState>,
  ) {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        const sets = ex.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s));
        return { ...ex, sets };
      }),
    );
  }

  function removeSet(exId: string, setIndex: number) {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        if (ex.sets.length <= 1) return ex;
        return { ...ex, sets: ex.sets.filter((_, i) => i !== setIndex) };
      }),
    );
  }

  function addSet(exId: string) {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              reps: last?.reps ?? ex.targetReps ?? null,
              weight: last?.weight ?? 0,
              done: false,
              rir: last?.rir ?? ex.targetRir ?? 1,
              rpe: null,
            },
          ],
        };
      }),
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateCompletedWorkout({
        workoutId: initial.id,
        exercises: exercises.map((ex) => ({
          id: ex.id,
          name: ex.name,
          note: ex.note ?? null,
          targetSets: ex.targetSets ?? null,
          targetReps: ex.targetReps ?? null,
          targetRir: ex.targetRir ?? null,
          tempo: ex.tempo ?? null,
          sets: ex.sets.map((s) => ({
            reps: s.reps,
            weight: s.weight,
            done:
              !s.skipped &&
              s.reps != null &&
              s.reps > 0 &&
              s.weight > 0,
            skipped: Boolean(s.skipped),
            rir: s.rir ?? null,
            rpe: s.rpe ?? null,
          })),
        })),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/workout-history");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-28">
      <header className="relative space-y-1 pr-12 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          {initial.weekdayLabel} · TYDZIEŃ {initial.planOccurrence}
        </p>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-white">
          Popraw trening
        </h1>
        <p className="text-[15px] font-medium text-white/85">{initial.title}</p>
        <p className="text-[12px] text-white/40">
          Możesz poprawiać do {deadlineLabel}.
        </p>
        <button
          type="button"
          onClick={() => router.push("/workout-history")}
          className="absolute right-0 top-1 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70"
          aria-label="Zamknij"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <ul className="space-y-3">
        {exercises.map((ex, exIdx) => (
          <li
            key={ex.id}
            className="app-panel px-3.5 py-3.5"
          >
            <div className="flex items-start gap-2.5">
              <span className="font-metric text-[18px] leading-none text-[var(--gym-gold)]">
                {pad2(exIdx + 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-white">{ex.name}</p>
                <p className="mt-0.5 text-[11px] text-white/40">
                  {formatExerciseTargetLine(ex)}
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {ex.sets.map((set, setIdx) => (
                <SetRow
                  key={setIdx}
                  index={setIdx}
                  set={set}
                  onChange={(patch) => updateSet(ex.id, setIdx, patch)}
                  onRemove={() => removeSet(ex.id, setIdx)}
                  canRemove={ex.sets.length > 1}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => addSet(ex.id)}
              className="mt-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]"
            >
              + Seria
            </button>
          </li>
        ))}
      </ul>

      {error ? (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-white/10 bg-black/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-lg gap-2">
          <button
            type="button"
            onClick={() => router.push("/workout-history")}
            className="h-12 flex-1 rounded-2xl border border-white/15 text-sm font-semibold text-white/80"
            disabled={pending}
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="gym-btn-primary inline-flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-2xl text-sm font-semibold disabled:opacity-60"
          >
            <Pencil className="h-4 w-4" />
            {pending ? "Zapis…" : "Zapisz poprawki"}
          </button>
        </div>
      </div>
    </div>
  );
}
