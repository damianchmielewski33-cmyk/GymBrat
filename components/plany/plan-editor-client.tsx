"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { saveWorkoutPlan } from "@/actions/workout-plan";
import { AppPageHeader } from "@/components/layout/screen";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { InlineBanner } from "@/components/ui/inline-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AtlasPickerList } from "@/components/plany/atlas/atlas-picker-list";
import {
  MUSCLE_CATEGORIES,
  type CatalogExercise,
} from "@/lib/workout-exercise-catalog";
import type { WorkoutPlanExercise, WorkoutPlanPayload } from "@/lib/workout-plan-types";
import {
  clearPlanDraft,
  readPlanDraft,
  writePlanDraft,
} from "@/lib/workout-plan/plan-draft-storage";
import { createDefaultPlanExercise } from "@/lib/workout-plan/plan-draft";
import { PLAN_NAME_MAX } from "@/lib/workout-plan/plan-validation";
import { normalizeYoutubeUrl } from "@/lib/youtube-url";
import { cn } from "@/lib/utils";

function ExerciseStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-[13px]">{label}</Label>
      <div className="flex h-12 overflow-hidden rounded-2xl border border-[rgba(235,196,74,0.35)] bg-black/50">
        <button
          type="button"
          className="grid h-12 w-12 place-items-center text-white"
          aria-label={`Zmniejsz ${label.toLowerCase()}`}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <input
          className="min-w-0 flex-1 bg-transparent text-center text-lg font-semibold tabular-nums text-white outline-none"
          inputMode="numeric"
          value={value}
          aria-live="polite"
          onChange={(e) => {
            const n = Number(e.target.value.replace(/\D/g, ""));
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
        />
        <button
          type="button"
          className="grid h-12 w-12 place-items-center text-white"
          aria-label={`Zwiększ ${label.toLowerCase()}`}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function PlanEditorClient({
  planId,
  initialPlan,
  catalog,
}: {
  planId: string | null;
  initialPlan: WorkoutPlanPayload;
  catalog: CatalogExercise[];
}) {
  const router = useRouter();
  const draftKey = planId ?? "new";
  const [plan, setPlan] = useState(initialPlan);
  const [dirty, setDirty] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(
    initialPlan.exercises[0]?.id ?? null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [draftOffer, setDraftOffer] = useState<WorkoutPlanPayload | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const draft = readPlanDraft(draftKey);
    if (
      draft &&
      JSON.stringify(draft) !== JSON.stringify(initialPlan)
    ) {
      setDraftOffer(draft);
    }
  }, [draftKey, initialPlan]);

  useEffect(() => {
    if (!dirty) return;
    writePlanDraft(draftKey, plan);
  }, [dirty, draftKey, plan]);

  function patch(next: WorkoutPlanPayload) {
    setPlan(next);
    setDirty(true);
    setError(null);
  }

  function updateExercise(id: string, patchEx: Partial<WorkoutPlanExercise>) {
    patch({
      ...plan,
      exercises: plan.exercises.map((ex) =>
        ex.id === id ? { ...ex, ...patchEx } : ex,
      ),
    });
  }

  function moveExercise(id: string, dir: -1 | 1) {
    const idx = plan.exercises.findIndex((e) => e.id === id);
    const nextIdx = idx + dir;
    if (idx < 0 || nextIdx < 0 || nextIdx >= plan.exercises.length) return;
    const exercises = [...plan.exercises];
    const [row] = exercises.splice(idx, 1);
    exercises.splice(nextIdx, 0, row!);
    patch({ ...plan, exercises });
  }

  function addFromCatalog(ex: CatalogExercise) {
    const row = createDefaultPlanExercise({
      name: ex.name,
      categoryId: ex.categoryId,
      techniqueYoutubeUrl: ex.techniqueYoutubeUrl ?? null,
    });
    const next = { ...plan, exercises: [...plan.exercises, row] };
    patch(next);
    setExpandedId(row.id);
  }

  function onSave() {
    const name = plan.planName.trim();
    if (!name) {
      setNameError("Podaj nazwę planu.");
      return;
    }
    if (name.length > PLAN_NAME_MAX) {
      setNameError("Nazwa może mieć do 80 znaków.");
      return;
    }
    setNameError(null);
    startTransition(async () => {
      const cleaned: WorkoutPlanPayload = {
        ...plan,
        planName: name,
        exercises: plan.exercises.map((ex) => ({
          ...ex,
          techniqueYoutubeUrl: ex.techniqueYoutubeUrl
            ? normalizeYoutubeUrl(ex.techniqueYoutubeUrl) ?? ex.techniqueYoutubeUrl
            : null,
        })),
      };
      const res = await saveWorkoutPlan(cleaned, planId ?? undefined);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      clearPlanDraft(draftKey);
      setDirty(false);
      router.push("/plany");
      router.refresh();
    });
  }

  function requestLeave() {
    if (dirty) setLeaveOpen(true);
    else router.push("/plany");
  }

  const isDraftEmpty = plan.exercises.length === 0;
  const canSaveToTreningi = !isDraftEmpty && plan.planName.trim().length > 0;

  return (
    <div className="flex min-h-[70vh] flex-col px-1 pb-28 pt-1 sm:px-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-11 px-0"
          aria-label="Zamknij edytor"
          onClick={requestLeave}
        >
          <X className="h-5 w-5" aria-hidden />
        </Button>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-[12px] font-semibold",
            dirty
              ? "border-[rgba(235,196,74,0.45)] text-[var(--gym-gold)]"
              : "border-white/15 text-[var(--gym-text-secondary)]",
          )}
          role="status"
        >
          {isDraftEmpty
            ? "Szkic"
            : dirty
              ? "Niezapisane zmiany"
              : "Zapisano"}
        </span>
      </div>

      <AppPageHeader
        kicker="Plan treningowy"
        title={plan.planName.trim() || "Nowy plan"}
      />

      {draftOffer ? (
        <InlineBanner variant="warning" className="mt-3">
          <p>Masz niezapisany szkic. Przywrócić?</p>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              variant="cta"
              className="h-10"
              onClick={() => {
                setPlan(draftOffer);
                setDirty(true);
                setDraftOffer(null);
              }}
            >
              Przywróć
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10"
              onClick={() => {
                clearPlanDraft(draftKey);
                setDraftOffer(null);
              }}
            >
              Odrzuć
            </Button>
          </div>
        </InlineBanner>
      ) : null}

      <section className="mt-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
          <span className="mr-2 text-[var(--gym-gold)]">01</span>
          Nazwa
        </p>
        <Label htmlFor="plan-name">Nazwa planu</Label>
        <div className="relative mt-1.5">
          <Input
            id="plan-name"
            className="h-12 pr-14"
            placeholder="np. Push A, Nogi, Pull"
            value={plan.planName}
            maxLength={PLAN_NAME_MAX}
            aria-invalid={!!nameError}
            onChange={(e) => {
              setNameError(null);
              patch({ ...plan, planName: e.target.value });
            }}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
            {plan.planName.length}/{PLAN_NAME_MAX}
          </span>
        </div>
        <p className="mt-1.5 text-[12px] text-[var(--gym-text-secondary)]">
          Krótko, np. nazwa dnia. Widać ją w Treningach.
        </p>
        {nameError ? (
          <p className="mt-1 text-[12px] text-rose-300" role="alert">
            {nameError}
          </p>
        ) : null}
      </section>

      <section className="mt-6">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
          <span className="mr-2 text-[var(--gym-gold)]">02</span>
          Ćwiczenia · {plan.exercises.length}
        </p>

        {plan.exercises.length === 0 ? (
          <div className="app-card border border-white/10 p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--gym-border-gold)] text-[var(--gym-gold)]">
              <Dumbbell className="h-7 w-7" aria-hidden />
            </div>
            <h2 className="mt-3 text-[15px] font-semibold text-white">
              Dodaj pierwsze ćwiczenie
            </h2>
            <p className="mt-1 text-[13px] text-[var(--gym-text-secondary)]">
              Wybierz partię w atlasie. Serie, powtórzenia i RIR ustawisz w wierszu
              ćwiczenia.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {plan.exercises.map((ex, index) => {
              const open = expandedId === ex.id;
              const cat =
                MUSCLE_CATEGORIES.find((c) => c.id === ex.categoryId)?.label ??
                ex.categoryId;
              return (
                <li
                  key={ex.id}
                  className={cn(
                    "overflow-hidden rounded-[22px] border border-[var(--gym-border-gold)] bg-[var(--gym-surface)]",
                    ex.supersetGroupId ? "border-l-2 border-l-[var(--gym-gold)]" : null,
                  )}
                >
                  <button
                    type="button"
                    className="flex min-h-16 w-full items-center gap-3 px-3 py-3 text-left"
                    aria-expanded={open}
                    onClick={() => setExpandedId(open ? null : ex.id)}
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-[12px] font-semibold tabular-nums text-white">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-white">
                        {ex.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
                        {ex.sets} × {ex.reps}
                        {ex.rir != null ? ` · RIR ${ex.rir}` : ""} · {cat}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 shrink-0 text-[var(--gym-text-secondary)] transition",
                        open ? "rotate-180" : null,
                      )}
                      aria-hidden
                    />
                  </button>
                  {open ? (
                    <div className="space-y-3.5 border-t border-white/10 px-3.5 pb-3.5 pt-3">
                      <div className="grid grid-cols-2 gap-2.5">
                        <ExerciseStepper
                          label="Serie"
                          value={ex.sets}
                          min={1}
                          max={20}
                          onChange={(n) => updateExercise(ex.id, { sets: n })}
                        />
                        <ExerciseStepper
                          label="Powtórzenia"
                          value={ex.reps}
                          min={1}
                          max={999}
                          onChange={(n) => updateExercise(ex.id, { reps: n })}
                        />
                      </div>
                      <div>
                        <Label className="mb-1.5 block">RIR</Label>
                        <div
                          role="radiogroup"
                          aria-label="RIR"
                          className="grid grid-cols-7 gap-1.5"
                        >
                          {[0, 1, 2, 3, 4, 5, null].map((v) => {
                            const on = ex.rir === v || (v === null && ex.rir == null);
                            return (
                              <button
                                key={String(v)}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                className={cn(
                                  "h-11 rounded-[14px] border text-[14px] font-medium tabular-nums",
                                  on
                                    ? "border-[rgba(235,196,74,0.6)] bg-[rgba(235,196,74,0.12)] font-bold text-white"
                                    : "border-[var(--gym-border-gold)] text-white/80",
                                )}
                                onClick={() =>
                                  updateExercise(ex.id, { rir: v })
                                }
                              >
                                {v === null ? "brak" : v}
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-1.5 text-[12px] text-[var(--gym-text-secondary)]">
                          Ile powtórzeń zostawiasz w zapasie. Brak = bez wartości.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor={`tempo-${ex.id}`}>Tempo</Label>
                        <Input
                          id={`tempo-${ex.id}`}
                          className="mt-1.5 h-12"
                          placeholder="np. 3010"
                          maxLength={8}
                          value={ex.tempo ?? ""}
                          onChange={(e) =>
                            updateExercise(ex.id, { tempo: e.target.value || null })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor={`yt-${ex.id}`}>Link do techniki</Label>
                        <Input
                          id={`yt-${ex.id}`}
                          className="mt-1.5 h-12"
                          inputMode="url"
                          placeholder="https://youtube.com/…"
                          value={ex.techniqueYoutubeUrl ?? ""}
                          onChange={(e) =>
                            updateExercise(ex.id, {
                              techniqueYoutubeUrl: e.target.value || null,
                            })
                          }
                        />
                        <p className="mt-1.5 text-[12px] text-[var(--gym-text-secondary)]">
                          Domyślny z atlasu. Zmiana dotyczy tylko tego planu.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor={`note-${ex.id}`}>Notatka</Label>
                        <Textarea
                          id={`note-${ex.id}`}
                          className="mt-1.5 min-h-24"
                          maxLength={200}
                          placeholder="np. łopatki ściągnięte"
                          value={ex.note ?? ""}
                          onChange={(e) =>
                            updateExercise(ex.id, { note: e.target.value || null })
                          }
                        />
                        <p className="mt-1.5 text-[12px] text-[var(--gym-text-secondary)]">
                          Nie wpisuj danych medycznych (np. kontuzji). Notatka jest
                          widoczna tylko dla Ciebie.
                        </p>
                      </div>
                      <label className="flex min-h-14 items-center justify-between gap-3">
                        <span>
                          <span className="block text-[14px] font-semibold text-white">
                            Superseria z następnym ćwiczeniem
                          </span>
                          <span className="mt-0.5 block text-[12px] text-[var(--gym-text-secondary)]">
                            {index >= plan.exercises.length - 1
                              ? "Brak następnego ćwiczenia."
                              : "Pokazuje oba ćwiczenia razem w Treningach."}
                          </span>
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={!!ex.supersetGroupId}
                          disabled={index >= plan.exercises.length - 1}
                          className={cn(
                            "relative h-7 w-12 shrink-0 rounded-full transition",
                            ex.supersetGroupId
                              ? "bg-[var(--gym-gold)]"
                              : "bg-white/12",
                          )}
                          onClick={() => {
                            const nextId = plan.exercises[index + 1]?.id;
                            if (!nextId) return;
                            const groupId = ex.supersetGroupId ?? crypto.randomUUID();
                            const on = !ex.supersetGroupId;
                            patch({
                              ...plan,
                              exercises: plan.exercises.map((row) => {
                                if (row.id === ex.id || row.id === nextId) {
                                  return {
                                    ...row,
                                    supersetGroupId: on ? groupId : null,
                                  };
                                }
                                return row;
                              }),
                            });
                          }}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white transition",
                              ex.supersetGroupId ? "left-[22px]" : "left-0.5",
                            )}
                          />
                        </button>
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11"
                          disabled={index === 0}
                          aria-label="Wyżej"
                          onClick={() => moveExercise(ex.id, -1)}
                        >
                          <ChevronUp className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11"
                          disabled={index >= plan.exercises.length - 1}
                          aria-label="Niżej"
                          onClick={() => moveExercise(ex.id, 1)}
                        >
                          <ChevronDown className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-11 text-rose-300"
                          aria-label="Usuń ćwiczenie"
                          onClick={() => setRemoveId(ex.id)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <Button
          type="button"
          variant="outline"
          className="mt-3 h-12 w-full gap-2"
          onClick={() => setPickerOpen(true)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Dodaj ćwiczenie
        </Button>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[rgba(7,7,8,0.96)] px-4 pb-4 pt-3">
        <div className="mx-auto w-full max-w-xl">
          {error ? (
            <InlineBanner variant="error" className="mb-2" role="alert">
              {error}{" "}
              <button type="button" className="underline" onClick={onSave}>
                Spróbuj ponownie
              </button>
            </InlineBanner>
          ) : null}
          <p className="mb-2 text-[12px] text-[var(--gym-text-secondary)]" role="status">
            {isDraftEmpty
              ? "Szkic. Dodaj ćwiczenie, aby plan pojawił się w Treningach."
              : dirty
                ? "Niezapisane zmiany"
                : "Gotowe do zapisu"}
          </p>
          <Button
            type="button"
            variant="cta"
            className="h-12 w-full"
            disabled={pending || !canSaveToTreningi}
            aria-busy={pending}
            onClick={onSave}
          >
            {pending ? "Zapisywanie…" : "Zapisz plan"}
          </Button>
        </div>
      </div>

      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-[22px]">
          <SheetHeader>
            <SheetTitle className="text-white">Dodaj ćwiczenie</SheetTitle>
          </SheetHeader>
          <div className="mt-3">
            <AtlasPickerList
              catalog={catalog}
              alreadyInPlanIds={plan.exercises.map(
                (e) =>
                  catalog.find((c) => c.name === e.name)?.id ?? e.id,
              )}
              onAdd={addFromCatalog}
            />
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        onConfirm={() => {
          clearPlanDraft(draftKey);
          router.push("/plany");
        }}
        title="Odrzucić zmiany?"
        description={`Plan „${plan.planName || "Nowy plan"}” ma zmiany, których nie zapisano.`}
        confirmLabel="Odrzuć zmiany"
        cancelLabel="Wróć do planu"
      />

      <ConfirmDialog
        open={!!removeId}
        onOpenChange={(o) => !o && setRemoveId(null)}
        onConfirm={() => {
          if (!removeId) return;
          patch({
            ...plan,
            exercises: plan.exercises.filter((e) => e.id !== removeId),
          });
          setRemoveId(null);
        }}
        title={`Usunąć „${plan.exercises.find((e) => e.id === removeId)?.name ?? ""}” z planu?`}
        description="Serie i ustawienia tego ćwiczenia znikną z planu. Historia treningów zostaje."
        confirmLabel="Usuń ćwiczenie"
      />
    </div>
  );
}
