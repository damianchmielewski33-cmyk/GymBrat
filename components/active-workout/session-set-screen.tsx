"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { formatCompactClock } from "@/lib/session-cursor";
import type { WorkoutSetState } from "@/components/workout/types";

export function SessionSetScreen({
  title,
  elapsedSeconds,
  doneSets,
  totalSets,
  exerciseName,
  setIndex,
  setCount,
  initial,
  previousLabel,
  onClose,
  onOpenList,
  onConfirm,
}: {
  title: string;
  elapsedSeconds: number;
  doneSets: number;
  totalSets: number;
  exerciseName: string;
  setIndex: number;
  setCount: number;
  initial: WorkoutSetState;
  previousLabel: string | null;
  onClose: () => void;
  onOpenList: () => void;
  onConfirm: (weight: number, reps: number) => void;
}) {
  const [weight, setWeight] = useState(initial.weight > 0 ? initial.weight : 0);
  const [reps, setReps] = useState(initial.reps && initial.reps > 0 ? initial.reps : 8);

  useEffect(() => {
    setWeight(initial.weight > 0 ? initial.weight : 0);
    setReps(initial.reps && initial.reps > 0 ? initial.reps : 8);
  }, [initial.weight, initial.reps, exerciseName, setIndex]);

  const pct = totalSets > 0 ? Math.min(100, (doneSets / totalSets) * 100) : 0;
  const canConfirm = reps > 0 && weight >= 0;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-black px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/70"
          aria-label="Zamknij"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
            {title}
          </p>
          <p className="mt-0.5 text-[12px] tabular-nums text-white/55">
            {formatCompactClock(elapsedSeconds)} · {doneSets}/{totalSets} serii
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenList}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/70"
          aria-label="Lista ćwiczeń"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#d4af37]" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-white/40">
          Seria {setIndex + 1} z {setCount}
        </p>
        <h1 className="font-heading mt-3 max-w-[22rem] text-3xl font-semibold text-white">{exerciseName}</h1>
        {previousLabel ? (
          <p className="mt-3 text-sm text-white/45">Ostatnio: {previousLabel}</p>
        ) : null}

        <div className="mt-10 grid w-full max-w-sm grid-cols-2 gap-3">
          <Stepper
            label="Ciężar"
            unit="kg"
            value={weight}
            onChange={(n) => setWeight(Math.max(0, Math.round(n * 2) / 2))}
            step={2.5}
          />
          <Stepper
            label="Powtórzenia"
            value={reps}
            onChange={(n) => setReps(Math.max(1, Math.min(99, Math.round(n))))}
            step={1}
          />
        </div>
      </div>

      <button
        type="button"
        disabled={!canConfirm}
        onClick={() => onConfirm(weight, reps)}
        className="mt-4 inline-flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#e8c547] to-[#c4a028] text-[15px] font-semibold text-[#1a1408] disabled:opacity-40"
      >
        Zalicz serię
      </button>
    </div>
  );
}

function Stepper({
  label,
  unit,
  value,
  onChange,
  step,
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (n: number) => void;
  step: number;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#161616] px-3 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className="font-heading mt-2 text-3xl font-semibold tabular-nums text-[#e8c547]">
        {value}
        {unit ? <span className="ml-1 text-sm font-medium text-[#e8c547]/70">{unit}</span> : null}
      </p>
      <div className="mt-3 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => onChange(value - step)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white"
          aria-label={`Zmniejsz ${label}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onChange(value + step)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white"
          aria-label={`Zwiększ ${label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
