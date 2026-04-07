"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Save, Sparkles } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { saveWorkoutPlan, type WorkoutPlanPayload } from "@/actions/workout-plan";
import { Button } from "@/components/ui/button";
import { WorkoutCard } from "@/components/workout-plan/workout-card";

type DayKey =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

const DAY_ORDER: Array<{ key: DayKey; label: string }> = [
  { key: "mon", label: "Pon" },
  { key: "tue", label: "Wto" },
  { key: "wed", label: "Śro" },
  { key: "thu", label: "Czw" },
  { key: "fri", label: "Pią" },
  { key: "sat", label: "Sob" },
  { key: "sun", label: "Nie" },
];

const MOCK_EXERCISES = [
  { id: "bench", name: "Wyciskanie na ławce" },
  { id: "squat", name: "Przysiad ze sztangą" },
  { id: "deadlift", name: "Martwy ciąg" },
  { id: "row", name: "Wiosłowanie na ławce (chest-supported)" },
  { id: "ohp", name: "Wyciskanie nad głowę" },
  { id: "pulldown", name: "Ściąganie drążka (lat pulldown)" },
  { id: "curl", name: "Uginanie hantlami" },
  { id: "triceps", name: "Prostowanie na triceps na wyciągu" },
];

function createDefaultPlan(): WorkoutPlanPayload {
  return {
    version: 1,
    week: DAY_ORDER.map((d) => ({
      dayKey: d.key,
      title: d.key === "wed" ? "Kondycja" : "Siła",
      exercises: [],
    })),
  };
}

function uid() {
  return crypto.randomUUID();
}

export function WorkoutPlanEditor({
  initialPlan,
}: {
  initialPlan: WorkoutPlanPayload | null;
}) {
  const [plan, setPlan] = useState<WorkoutPlanPayload>(
    initialPlan ?? createDefaultPlan(),
  );
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedPulse, setSavedPulse] = useState(0);
  const [mockPickIdx, setMockPickIdx] = useState(0);

  const dayMap = useMemo(() => {
    const map = new Map<
      string,
      { title: string; exercises: Array<{ id: string; name: string }> }
    >();
    for (const d of plan.week) {
      map.set(d.dayKey, { title: d.title, exercises: d.exercises });
    }
    return map;
  }, [plan.week]);

  function updateDay(dayKey: string, patch: Partial<(typeof plan.week)[number]>) {
    setPlan((prev) => ({
      ...prev,
      week: prev.week.map((d) => (d.dayKey === dayKey ? { ...d, ...patch } : d)),
    }));
  }

  function addMockExercise(dayKey: string) {
    const pick = MOCK_EXERCISES[mockPickIdx % MOCK_EXERCISES.length];
    setMockPickIdx((x) => x + 1);
    updateDay(dayKey, {
      exercises: [
        ...(dayMap.get(dayKey)?.exercises ?? []),
        { id: `${pick.id}-${uid()}`, name: pick.name },
      ],
    });
  }

  function removeExercise(dayKey: string, exerciseId: string) {
    updateDay(dayKey, {
      exercises: (dayMap.get(dayKey)?.exercises ?? []).filter(
        (e) => e.id !== exerciseId,
      ),
    });
  }

  function onSave() {
    setSaveError(null);
    startTransition(async () => {
      const res = await saveWorkoutPlan(plan);
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      setSavedPulse((x) => x + 1);
    });
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
            Harmonogram tygodnia
          </p>
          <h1 className="font-heading metallic-text mt-1 text-3xl font-semibold">
            Plan treningowy
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/65">
            Ułóż tydzień, dodaj przykładowe ćwiczenia i zapisz plan do Turso.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <AnimatePresence>
            {saveError ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="rounded-full border border-red-500/25 bg-red-500/10 px-4 py-2 text-xs text-red-200"
              >
                {saveError}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <motion.div
            key={savedPulse}
            initial={{ opacity: 0.85, scale: 1 }}
            animate={{ opacity: 1, scale: 1.02 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 md:inline-flex"
          >
            <Sparkles className="h-4 w-4 text-[var(--neon)]" />
            Editor · v1
          </motion.div>

          <Button
            type="button"
            onClick={onSave}
            disabled={isPending}
            className="bg-[var(--neon)] text-white hover:bg-[#ff4d6d]"
          >
            <Save className="mr-2 h-4 w-4" />
            {isPending ? "Zapisywanie…" : "Zapisz plan"}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DAY_ORDER.map((d) => {
          const day = plan.week.find((x) => x.dayKey === d.key);
          return (
            <WorkoutCard
              key={d.key}
              dayLabel={d.label}
              title={day?.title ?? ""}
              exercises={day?.exercises ?? []}
              onChangeTitle={(t) => updateDay(d.key, { title: t })}
              onAddExercise={() => addMockExercise(d.key)}
              onRemoveExercise={(id) => removeExercise(d.key, id)}
            />
          );
        })}
      </div>
    </div>
  );
}

