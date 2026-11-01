"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveFitnessGoalsAction } from "@/actions/fitness-goals";
import { Surface } from "@/components/progress/progress-ui";

export type ExerciseTargetDraft = {
  name: string;
  targetKg?: number;
  targetReps?: number;
  deadline?: string;
};

const MAX_TARGETS = 12;

const inputClass =
  "h-10 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-[14px] text-white outline-none focus:border-[var(--gym-gold)]/50";

function parseKg(raw: string): number | null {
  const n = Number(raw.replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 && n <= 1000 ? Math.round(n * 10) / 10 : null;
}

/** Cele siłowe: ćwiczenie + ciężar × powtórzenia + opcjonalny termin. */
export function ExerciseGoalsEditor({
  targets,
  exerciseNames,
}: {
  targets: ExerciseTargetDraft[];
  exerciseNames: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kg, setKg] = useState("");
  const [reps, setReps] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);

  function persist(next: ExerciseTargetDraft[], onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await saveFitnessGoalsAction({ exerciseTargets: next });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onOk?.();
      router.refresh();
    });
  }

  function add() {
    const targetKg = parseKg(kg);
    const trimmed = name.trim();
    if (!trimmed) return setError("Wybierz ćwiczenie.");
    if (targetKg == null) return setError("Podaj ciężar docelowy (kg).");
    const repsN = reps.trim() === "" ? undefined : Math.round(Number(reps));
    if (repsN != null && (!Number.isFinite(repsN) || repsN < 1 || repsN > 30)) {
      return setError("Powtórzenia: 1–30.");
    }
    if (targets.length >= MAX_TARGETS) return setError("Maksymalnie 12 celów.");
    persist(
      [
        ...targets.filter((t) => t.name.toLowerCase() !== trimmed.toLowerCase()),
        {
          name: trimmed,
          targetKg,
          ...(repsN ? { targetReps: repsN } : {}),
          ...(deadline ? { deadline } : {}),
        },
      ],
      () => {
        setAdding(false);
        setName("");
        setKg("");
        setReps("");
        setDeadline("");
      },
    );
  }

  return (
    <Surface className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-white">Cele siłowe</p>
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--gym-gold)]"
          >
            Dodaj cel
          </button>
        ) : null}
      </div>

      {targets.length === 0 && !adding ? (
        <p className="text-[12px] text-white/50">
          Ustaw np. „Wyciskanie 100 kg × 5 do końca roku” — pokażemy prognozę.
        </p>
      ) : null}

      {targets.map((t) => (
        <div key={t.name} className="flex items-center justify-between gap-2 text-[13px]">
          <span className="min-w-0 truncate text-white/85">
            {t.name} · {t.targetKg} kg{t.targetReps ? ` × ${t.targetReps}` : ""}
            {t.deadline ? ` · do ${t.deadline}` : ""}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => persist(targets.filter((x) => x.name !== t.name))}
            className="shrink-0 text-[11px] text-white/45 disabled:opacity-50"
            aria-label={`Usuń cel ${t.name}`}
          >
            Usuń
          </button>
        </div>
      ))}

      {adding ? (
        <div className="space-y-2">
          <input
            list="exercise-goal-names"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ćwiczenie"
            aria-label="Ćwiczenie"
            className={inputClass}
          />
          <datalist id="exercise-goal-names">
            {exerciseNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <div className="grid grid-cols-2 gap-2">
            <input
              inputMode="decimal"
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              placeholder="Ciężar (kg)"
              aria-label="Ciężar docelowy"
              className={inputClass}
            />
            <input
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder="Powt. (opcj.)"
              aria-label="Powtórzenia docelowe"
              className={inputClass}
            />
          </div>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            aria-label="Termin celu"
            className={inputClass}
          />
          <div className="flex gap-4 text-[12px] font-semibold uppercase tracking-[0.12em]">
            <button
              type="button"
              disabled={pending}
              onClick={add}
              className="text-[var(--gym-gold)] disabled:opacity-50"
            >
              Zapisz
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="text-white/40"
            >
              Anuluj
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-[11px] text-rose-300">{error}</p> : null}
    </Surface>
  );
}
