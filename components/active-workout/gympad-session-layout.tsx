"use client";

import { motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import { GymPadSetRow } from "@/components/workout/gympad-set-row";
import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";
import {
  exerciseTotalReps,
  exerciseVolume,
  formatVolumeKg,
} from "@/lib/workout-session-calculations";
import type { LastPlanHintsMap } from "@/lib/last-workout-hints";
import type { ExercisePrs } from "@/lib/exercise-progress";
import { estimated1RM } from "@/lib/workout-history";
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

function formatPreviousSetLabel(s: WorkoutSetState | undefined): string | null {
  if (!s || !(s.weight > 0)) return null;
  const r = s.reps != null ? String(s.reps) : "—";
  const rp = s.rpe != null ? ` RPE${s.rpe}` : "";
  return `${s.weight}×${r}${rp}`;
}

function computeSetPrBadge(set: WorkoutSetState, prs: ExercisePrs | null): string | null {
  if (!set.done || set.reps == null || set.reps <= 0 || !(set.weight > 0)) return null;
  if (!prs) return null;
  const e1 = estimated1RM(set.weight, set.reps);
  const hasHistory = prs.maxE1rm.value > 0 || prs.maxWeight.value > 0;
  const eps = 0.05;
  if (!hasHistory) return "Pierwszy zapis";
  if (e1 > prs.maxE1rm.value + eps) return "Nowy rekord 1RM";
  if (set.weight > prs.maxWeight.value + eps) return "Nowy rekord ciężaru";
  return null;
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
  const [prsForExercise, setPrsForExercise] = useState<ExercisePrs | null>(null);

  const current = useMemo(
    () => exercises.find((e) => e.id === selectedExerciseId) ?? exercises[0] ?? null,
    [exercises, selectedExerciseId],
  );

  useEffect(() => {
    const name = current?.name?.trim();
    if (!name) {
      queueMicrotask(() => setPrsForExercise(null));
      return;
    }
    let cancelled = false;
    const tid = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/progress/exercise?q=${encodeURIComponent(name)}`,
            { credentials: "include" },
          );
          const data = (await res.json()) as { ok?: boolean; prs?: ExercisePrs };
          if (cancelled) return;
          if (data.ok && data.prs) setPrsForExercise(data.prs);
          else setPrsForExercise(null);
        } catch {
          if (!cancelled) setPrsForExercise(null);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, [current?.name]);

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

  const hintSetsForCurrent =
    current && lastHints ? lastHints[current.id]?.sets : undefined;

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

  const handleExerciseTabListKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (exercises.length === 0) return;
      const tab = (e.target as HTMLElement | null)?.closest?.("button[role='tab']") as
        | HTMLButtonElement
        | null;
      if (!tab || !e.currentTarget.contains(tab)) return;

      const prefix = "ex-tab-";
      if (!tab.id.startsWith(prefix)) return;
      const fromId = tab.id.slice(prefix.length);
      const idx = exercises.findIndex((x) => x.id === fromId);
      if (idx < 0) return;

      let nextIdx = idx;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          if (exercises.length <= 1) return;
          e.preventDefault();
          nextIdx = (idx + 1) % exercises.length;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          if (exercises.length <= 1) return;
          e.preventDefault();
          nextIdx = (idx - 1 + exercises.length) % exercises.length;
          break;
        case "Home":
          if (exercises.length <= 1) return;
          e.preventDefault();
          nextIdx = 0;
          break;
        case "End":
          if (exercises.length <= 1) return;
          e.preventDefault();
          nextIdx = exercises.length - 1;
          break;
        default:
          return;
      }

      const next = exercises[nextIdx];
      if (!next) return;
      onSelectExercise(next.id);
      requestAnimationFrame(() => {
        const el = document.getElementById(`${prefix}${next.id}`) as HTMLButtonElement | null;
        el?.focus({ preventScroll: true });
        el?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
      });
    },
    [exercises, onSelectExercise],
  );

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
        <span
          className="shrink-0 font-mono text-[26px] font-semibold leading-none tabular-nums text-[var(--neon)] sm:text-3xl"
          aria-label={`Czas trwania sesji: ${formatHMS(elapsedSeconds)}`}
        >
          {formatHMS(elapsedSeconds)}
        </span>
      </div>

      <div className="mt-3">
        <div
          className="-mx-1 flex gap-1 overflow-x-auto pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Ćwiczenia w sesji"
          aria-orientation="horizontal"
          onKeyDown={handleExerciseTabListKeyDown}
        >
        {exercises.map((ex) => {
          const active = ex.id === current?.id;
          return (
            <button
              key={ex.id}
              id={`ex-tab-${ex.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`ex-panel-${ex.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelectExercise(ex.id)}
              className={cn(
                "relative min-h-11 shrink-0 rounded-full px-3 py-2 text-left text-[13px] font-semibold outline-none transition focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708]",
                active
                  ? "bg-white/[0.08] text-white"
                  : "bg-transparent text-white/45 hover:bg-white/[0.05] hover:text-white/75",
              )}
            >
              {active ? <span className="absolute inset-0 rounded-full ring-1 ring-white/10" aria-hidden /> : null}
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
          id={`ex-panel-${current.id}`}
          role="tabpanel"
          aria-labelledby={`ex-tab-${current.id}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="pt-4 outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring/75 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708]"
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
                previousLabel={formatPreviousSetLabel(hintSetsForCurrent?.[idx])}
                prBadge={computeSetPrBadge(set, prsForExercise)}
              />
            ))}
          </div>

          {onExerciseNoteChange ? (
            <div className="mt-4 space-y-1.5">
              <label
                htmlFor={`ex-note-${current.id}`}
                className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55"
              >
                Notatka do ćwiczenia
              </label>
              <Textarea
                id={`ex-note-${current.id}`}
                value={current.note ?? ""}
                onChange={(e) => onExerciseNoteChange(current.id, e.target.value)}
                placeholder="Technika, martwy punkt, zmiana maszyny…"
                className="min-h-[72px] resize-none rounded-xl border-white/14 bg-white/[0.06] text-sm text-white placeholder:text-white/38 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708]"
              />
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-between gap-3">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onAddSet(current.id)}
              aria-label={`Dodaj serię dla ćwiczenia: ${current.name}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--neon)] px-5 py-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(230,0,35,0.20)] outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708]"
            >
              <Plus className="h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden />
              Dodaj serię
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              disabled={current.sets.length <= 1}
              onClick={() => onRemoveLastSet(current.id)}
              aria-label={
                current.sets.length <= 1
                  ? "Nie można usunąć jedynej serii"
                  : `Usuń ostatnią serię ćwiczenia: ${current.name}`
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/75 outline-none hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708] disabled:pointer-events-none disabled:opacity-35"
            >
              <Minus className="h-5 w-5 shrink-0" aria-hidden />
              Usuń
            </motion.button>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
