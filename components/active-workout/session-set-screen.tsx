"use client";

import { ExternalLink, Link2, Menu, Minus, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { formatCompactClock } from "@/lib/session-cursor";
import { resolveExerciseVideoUrl } from "@/lib/exercise-video";
import type { WorkoutSetState } from "@/components/workout/types";

export type SessionSetConfirm = {
  weight: number;
  reps: number;
  rpe: number | null;
  rir: number | null;
  tempo: string | null;
};

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
  suggestedWeightKg,
  videoUrl,
  catalogId,
  supersetPartnerNames,
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
  suggestedWeightKg?: number | null;
  videoUrl?: string | null;
  catalogId?: string | null;
  supersetPartnerNames?: string[];
  onClose: () => void;
  onOpenList: () => void;
  onConfirm: (values: SessionSetConfirm) => void;
}) {
  const suggestion =
    suggestedWeightKg != null && suggestedWeightKg > 0 ? suggestedWeightKg : null;
  const [weight, setWeight] = useState(
    initial.weight > 0 ? initial.weight : (suggestion ?? 0),
  );
  const [reps, setReps] = useState(initial.reps && initial.reps > 0 ? initial.reps : 8);
  const [rpe, setRpe] = useState<number | null>(initial.rpe ?? null);
  const [rir, setRir] = useState<number | null>(initial.rir ?? null);
  const [tempo, setTempo] = useState(initial.tempo ?? "");

  useEffect(() => {
    setWeight(initial.weight > 0 ? initial.weight : (suggestion ?? 0));
    setReps(initial.reps && initial.reps > 0 ? initial.reps : 8);
    setRpe(initial.rpe ?? null);
    setRir(initial.rir ?? null);
    setTempo(initial.tempo ?? "");
  }, [
    initial.weight,
    initial.reps,
    initial.rpe,
    initial.rir,
    initial.tempo,
    suggestion,
    exerciseName,
    setIndex,
  ]);

  const pct = totalSets > 0 ? Math.min(100, (doneSets / totalSets) * 100) : 0;
  const canConfirm = reps > 0 && weight >= 0;
  const filmHref = resolveExerciseVideoUrl({
    catalogId,
    name: exerciseName,
    overrideUrl: videoUrl,
  });

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
        <h1 className="font-heading mt-3 max-w-[22rem] text-3xl font-semibold text-white">
          {exerciseName}
        </h1>
        {supersetPartnerNames && supersetPartnerNames.length > 0 ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-[#e8485a]">
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            Superseria: {supersetPartnerNames.join(", ")}
          </p>
        ) : null}
        {previousLabel ? (
          <p className="mt-3 text-sm text-white/45">Ostatnio: {previousLabel}</p>
        ) : null}
        {suggestion != null ? (
          <button
            type="button"
            onClick={() => setWeight(suggestion)}
            className="mt-2 text-sm font-medium text-amber-200/90 underline-offset-2 hover:underline"
          >
            Sugestia: {suggestion} kg
          </button>
        ) : null}

        <div className="mt-8 grid w-full max-w-sm grid-cols-2 gap-3">
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

        <div className="mt-4 grid w-full max-w-sm grid-cols-3 gap-2">
          <SelectField
            label="RPE"
            value={rpe}
            emptyLabel="—"
            options={Array.from({ length: 10 }, (_, i) => i + 1)}
            onChange={setRpe}
          />
          <SelectField
            label="RIR"
            value={rir}
            emptyLabel="—"
            options={[0, 1, 2, 3, 4, 5]}
            onChange={setRir}
          />
          <div className="text-left">
            <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
              Tempo
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="3-1-2"
              maxLength={16}
              value={tempo}
              onChange={(e) => setTempo(e.target.value)}
              className="mt-1 flex h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-2 text-center text-sm tabular-nums text-white outline-none focus-visible:border-[#d4af37]/60"
            />
          </div>
        </div>

        <a
          href={filmHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-white/65 hover:text-white"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Film / technika
        </a>
      </div>

      <button
        type="button"
        disabled={!canConfirm}
        onClick={() =>
          onConfirm({
            weight,
            reps,
            rpe,
            rir,
            tempo: tempo.trim() || null,
          })
        }
        className="mt-4 inline-flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#e8c547] to-[#c4a028] text-[15px] font-semibold text-[#1a1408] disabled:opacity-40"
      >
        Zalicz serię
      </button>
    </div>
  );
}

function SelectField({
  label,
  value,
  emptyLabel,
  options,
  onChange,
}: {
  label: string;
  value: number | null;
  emptyLabel: string;
  options: number[];
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="text-left">
      <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
        {label}
      </label>
      <select
        value={value == null ? "" : String(value)}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
        className="mt-1 flex h-11 w-full rounded-xl border border-white/15 bg-white/[0.06] px-2 text-center text-sm text-white outline-none focus-visible:border-[#d4af37]/60"
      >
        <option value="">{emptyLabel}</option>
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
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
    <div className="rounded-2xl border border-white/12 bg-white/[0.04] px-3 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
        {label}
        {unit ? ` (${unit})` : ""}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onChange(value - step)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70"
          aria-label={`Zmniejsz ${label}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <p className="min-w-[3.5rem] text-2xl font-semibold tabular-nums text-white">{value}</p>
        <button
          type="button"
          onClick={() => onChange(value + step)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70"
          aria-label={`Zwiększ ${label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
