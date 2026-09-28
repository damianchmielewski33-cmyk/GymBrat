"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type EditableSet = {
  reps: number | null;
  weight: number;
  done: boolean;
  rpe?: number | null;
  rir?: number | null;
  tempo?: string | null;
};

export type EditableExercise = {
  id: string;
  name: string;
  note?: string | null;
  sets: EditableSet[];
};

export function WorkoutHistoryEditForm({
  workoutId,
  initialTitle,
  initialExercises,
}: {
  workoutId: string;
  initialTitle: string;
  initialExercises: EditableExercise[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [exercises, setExercises] = useState(initialExercises);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setCount = useMemo(
    () => exercises.reduce((n, e) => n + e.sets.length, 0),
    [exercises],
  );

  function patchSet(
    exIdx: number,
    setIdx: number,
    patch: Partial<EditableSet>,
  ) {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== exIdx
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, ...patch } : s)),
            },
      ),
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await ensureCsrfCookie();
        const res = await fetch(`/api/workouts/${workoutId}`, {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...getXsrfHeaders(),
          },
          body: JSON.stringify({ title, exercises }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setError(data.error || "Nie udało się zapisać zmian");
          return;
        }
        setOpen(false);
        router.refresh();
      } catch {
        setError("Błąd sieci — spróbuj ponownie");
      }
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-11 border-white/15 bg-white/5 text-white/85 hover:bg-white/10"
        onClick={() => setOpen(true)}
      >
        Edytuj trening
      </Button>
    );
  }

  return (
    <div className="glass-panel neon-glow space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
            Edycja (do 7 dni)
          </p>
          <p className="mt-1 text-sm text-white/70">
            {exercises.length} ćw. · {setCount} serii
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="border-white/15"
            onClick={() => {
              setExercises(initialExercises);
              setTitle(initialTitle);
              setOpen(false);
              setError(null);
            }}
          >
            Anuluj
          </Button>
          <Button type="button" disabled={pending} onClick={save}>
            {pending ? "Zapis…" : "Zapisz"}
          </Button>
        </div>
      </div>

      <div className="grid gap-1">
        <Label htmlFor="edit-title">Tytuł</Label>
        <Input
          id="edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border-white/15 bg-black/30 text-white"
        />
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <ul className="space-y-4">
        {exercises.map((ex, exIdx) => (
          <li key={ex.id} className="rounded-xl border border-white/10 bg-black/25 p-3">
            <p className="font-medium text-white">{ex.name}</p>
            <div className="mt-3 space-y-2">
              {ex.sets.map((s, setIdx) => (
                <div
                  key={setIdx}
                  className="grid grid-cols-2 gap-2 sm:grid-cols-5"
                >
                  <div>
                    <Label className="text-[10px] text-white/45">Powt.</Label>
                    <Input
                      type="number"
                      value={s.reps ?? ""}
                      onChange={(e) => {
                        const t = e.target.value;
                        patchSet(exIdx, setIdx, {
                          reps: t === "" ? null : Number(t),
                        });
                      }}
                      className="h-9 border-white/15 bg-black/30 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-white/45">Kg</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={s.weight > 0 ? s.weight : ""}
                      onChange={(e) =>
                        patchSet(exIdx, setIdx, {
                          weight: Number(e.target.value) || 0,
                        })
                      }
                      className="h-9 border-white/15 bg-black/30 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-white/45">RPE</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={s.rpe ?? ""}
                      onChange={(e) => {
                        const t = e.target.value;
                        patchSet(exIdx, setIdx, {
                          rpe: t === "" ? null : Number(t),
                        });
                      }}
                      className="h-9 border-white/15 bg-black/30 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-white/45">RIR</Label>
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      value={s.rir ?? ""}
                      onChange={(e) => {
                        const t = e.target.value;
                        patchSet(exIdx, setIdx, {
                          rir: t === "" ? null : Number(t),
                        });
                      }}
                      className="h-9 border-white/15 bg-black/30 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-white/45">Tempo</Label>
                    <Input
                      value={s.tempo ?? ""}
                      onChange={(e) =>
                        patchSet(exIdx, setIdx, {
                          tempo: e.target.value.trim() || null,
                        })
                      }
                      className="h-9 border-white/15 bg-black/30 text-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
