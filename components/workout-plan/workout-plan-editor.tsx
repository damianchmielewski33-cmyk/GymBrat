"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Lock,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  deleteWorkoutPlan,
  saveWorkoutPlan,
  type WorkoutPlanListItemDTO,
  type WorkoutPlanExercise,
  type WorkoutPlanPayload,
} from "@/actions/workout-plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  MUSCLE_CATEGORIES,
  categoryLabel,
  findBestCatalogMatch,
  searchCatalogForPicker,
} from "@/lib/workout-exercise-catalog";
import { cn } from "@/lib/utils";
import { useSaveFeedback } from "@/components/feedback/save-feedback";

function uid() {
  return crypto.randomUUID();
}

function createEmptyPlan(): WorkoutPlanPayload {
  return {
    version: 2,
    path: "custom",
    planName: "",
    exercises: [],
    userCustomExerciseNames: [],
  };
}

function formatPlanDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type EditorMode = "closed" | "new" | { id: string };

export function WorkoutPlanEditor({
  initialPlans,
}: {
  initialPlans: WorkoutPlanListItemDTO[];
}) {
  const router = useRouter();
  const { notifySaved } = useSaveFeedback();
  const [editorMode, setEditorMode] = useState<EditorMode>("closed");
  const [plan, setPlan] = useState<WorkoutPlanPayload>(createEmptyPlan());
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedPulse, setSavedPulse] = useState(0);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [addCategoryId, setAddCategoryId] = useState(MUSCLE_CATEGORIES[0]!.id);
  const [search, setSearch] = useState("");
  const [customName, setCustomName] = useState("");
  const [showCustomRow, setShowCustomRow] = useState(false);

  const editorOpen = editorMode !== "closed";

  const filteredCatalog = useMemo(
    () => searchCatalogForPicker(addCategoryId, search),
    [addCategoryId, search],
  );

  const customMatchPreview = useMemo(() => {
    const t = customName.trim();
    if (t.length < 2) return null;
    return findBestCatalogMatch(t);
  }, [customName]);

  const customNamesForCategory = useMemo(() => {
    return plan.userCustomExerciseNames.filter((name) => {
      if (!search.trim()) return true;
      return name.toLowerCase().includes(search.trim().toLowerCase());
    });
  }, [plan.userCustomExerciseNames, search]);

  const updateExercise = useCallback(
    (id: string, patch: Partial<WorkoutPlanExercise>) => {
      setPlan((prev) => ({
        ...prev,
        exercises: prev.exercises.map((e) =>
          e.id === id ? { ...e, ...patch } : e,
        ),
      }));
    },
    [],
  );

  const removeExercise = useCallback((id: string) => {
    setPlan((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((e) => e.id !== id),
    }));
  }, []);

  const addFromCatalog = useCallback(
    (name: string, categoryId: string) => {
      setPlan((prev) => ({
        ...prev,
        exercises: [
          ...prev.exercises,
          {
            id: uid(),
            name,
            categoryId,
            reps: 10,
          },
        ],
      }));
      setSheetOpen(false);
      setSearch("");
      setShowCustomRow(false);
      setCustomName("");
    },
    [],
  );

  const addCustomExercise = useCallback(() => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    const catalogHit = findBestCatalogMatch(trimmed);
    if (catalogHit) {
      addFromCatalog(catalogHit.name, catalogHit.categoryId);
      return;
    }
    setPlan((prev) => ({
      ...prev,
      userCustomExerciseNames: prev.userCustomExerciseNames.includes(trimmed)
        ? prev.userCustomExerciseNames
        : [...prev.userCustomExerciseNames, trimmed],
      exercises: [
        ...prev.exercises,
        {
          id: uid(),
          name: trimmed,
          categoryId: addCategoryId,
          reps: 10,
        },
      ],
    }));
    setSheetOpen(false);
    setCustomName("");
    setShowCustomRow(false);
    setSearch("");
  }, [addCategoryId, customName, addFromCatalog]);

  function onSave() {
    setSaveError(null);
    if (!plan.planName.trim()) {
      setSaveError("Podaj nazwę planu.");
      return;
    }
    const planId =
      editorMode === "closed" || editorMode === "new"
        ? undefined
        : editorMode.id;
    startTransition(async () => {
      const res = await saveWorkoutPlan(plan, planId);
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      notifySaved("Zapisano plan treningowy.");
      setSavedPulse((x) => x + 1);
      setEditorMode("closed");
      router.refresh();
    });
  }

  function startNewPlan() {
    setEditorMode("new");
    setPlan(createEmptyPlan());
    setSaveError(null);
  }

  function openEditPlan(id: string) {
    const row = initialPlans.find((p) => p.id === id);
    if (!row) return;
    setEditorMode({ id });
    setPlan(structuredClone(row.plan));
    setSaveError(null);
  }

  function closeEditor() {
    setEditorMode("closed");
    setSaveError(null);
  }

  async function onDeletePlan(id: string) {
    if (
      !window.confirm(
        "Czy na pewno usunąć ten plan treningowy? Tej operacji nie można cofnąć.",
      )
    ) {
      return;
    }
    const res = await deleteWorkoutPlan(id);
    if (!res.ok) return;
    notifySaved("Usunięto plan treningowy.");
    if (typeof editorMode === "object" && editorMode !== null && editorMode.id === id) {
      setEditorMode("closed");
    }
    setExpandedPlanId((e) => (e === id ? null : e));
    router.refresh();
  }

  function toggleExpand(id: string) {
    setExpandedPlanId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
            Trening
          </p>
          <h1 className="font-heading metallic-text mt-1 text-3xl font-semibold">
            Plan treningowy
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/65">
            {editorOpen
              ? "Nadaj nazwę planu, przypisz partie mięśniowe, ćwiczenia i liczbę powtórzeń. Zapis zwija edytor i dodaje plan do listy."
              : "Twórz wiele planów — każdy zapis pojawia się na liście poniżej."}
          </p>
        </div>

        {editorOpen ? (
          <div className="flex flex-wrap items-center gap-3">
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
              {editorMode === "new" ? "Nowy plan" : "Edycja planu"}
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
        ) : null}
      </header>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold text-white">
          Lista planów
        </h2>
        {initialPlans.length === 0 ? (
          <div className="glass-panel rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/55">
            Nie masz jeszcze zapisanego planu. Wybierz „Dodaj swój plan
            treningowy” poniżej — po zapisie plan pojawi się tutaj.
          </div>
        ) : (
          <ul className="space-y-2">
            {initialPlans.map((item) => {
              const expanded = expandedPlanId === item.id;
              const name =
                item.plan.planName.trim() || "Plan bez nazwy";
              return (
                <li key={item.id} className="glass-panel overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleExpand(item.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/5"
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-white/50" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/50" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">{name}</p>
                      <p className="text-xs text-white/45">
                        {item.plan.exercises.length}{" "}
                        {item.plan.exercises.length === 1
                          ? "ćwiczenie"
                          : item.plan.exercises.length < 5
                            ? "ćwiczenia"
                            : "ćwiczeń"}{" "}
                        · {formatPlanDate(item.updatedAt)}
                      </p>
                    </div>
                  </button>
                  <AnimatePresence initial={false}>
                    {expanded ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-white/10"
                      >
                        <div className="space-y-3 px-4 py-3 pl-11">
                          {item.plan.exercises.length === 0 ? (
                            <p className="text-sm text-white/45">
                              Brak ćwiczeń w tym planie.
                            </p>
                          ) : (
                            <ol className="list-decimal space-y-1 pl-4 text-sm text-white/75">
                              {item.plan.exercises.map((ex) => (
                                <li key={ex.id}>
                                  <span className="text-white/50">
                                    {categoryLabel(ex.categoryId)} ·{" "}
                                  </span>
                                  {ex.name}{" "}
                                  <span className="text-white/40">
                                    ({ex.reps} powt.)
                                  </span>
                                </li>
                              ))}
                            </ol>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-white/15"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditPlan(item.id);
                              }}
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" />
                              Edytuj
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-red-500/30 text-red-300 hover:bg-red-500/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                void onDeletePlan(item.id);
                              }}
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Usuń
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AnimatePresence mode="wait">
        {!editorOpen ? (
          <motion.div
            key="choice"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="grid gap-4 md:grid-cols-2"
          >
            <button
              type="button"
              onClick={startNewPlan}
              className="glass-panel group relative overflow-hidden rounded-2xl p-8 text-left transition hover:border-[var(--neon)]/40"
            >
              <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(120deg,rgba(255,255,255,0.10),transparent_55%),radial-gradient(540px_260px_at_10%_10%,rgba(255,45,85,0.16),transparent_60%)]" />
              <div className="relative space-y-3">
                <Dumbbell className="h-8 w-8 text-[var(--neon)]" />
                <h2 className="font-heading text-xl font-semibold text-white">
                  Dodaj swój plan treningowy
                </h2>
                <p className="text-sm text-white/65">
                  Nazwa planu, partie mięśniowe, ćwiczenia z listy lub własne,
                  liczba powtórzeń. Po zapisie plan trafi na listę powyżej.
                </p>
              </div>
            </button>

            <div className="glass-panel relative overflow-hidden rounded-2xl p-8 opacity-60">
              <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(120deg,rgba(255,255,255,0.06),transparent_55%)]" />
              <div className="relative space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-8 w-8 text-white/40" />
                  <span className="rounded-full border border-white/15 bg-black/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/50">
                    Wkrótce
                  </span>
                </div>
                <h2 className="font-heading text-xl font-semibold text-white/80">
                  Stwórz plan treningowy z AI
                </h2>
                <p className="text-sm text-white/50">
                  Ta opcja będzie dostępna w przyszłości — automatyczne układanie
                  planu na podstawie celów i sprzętu.
                </p>
                <Button type="button" disabled variant="outline" className="mt-2">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Niedostępne
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="editor"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-6"
          >
            <button
              type="button"
              onClick={closeEditor}
              className="inline-flex items-center gap-2 text-sm text-white/60 transition hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
              Zamknij edytor
            </button>

            <div className="glass-panel p-6">
              <Label
                htmlFor="plan-name"
                className="text-xs uppercase tracking-[0.15em] text-white/55"
              >
                Nazwa planu
              </Label>
              <Input
                id="plan-name"
                value={plan.planName}
                onChange={(e) =>
                  setPlan((p) => ({ ...p, planName: e.target.value }))
                }
                placeholder="np. Siła — góra ciała"
                className="mt-2 h-10 border-white/15 bg-black/25 text-white placeholder:text-white/35"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-heading text-lg font-semibold text-white">
                Ćwiczenia w planie
              </h2>
              <Button
                type="button"
                onClick={() => {
                  setAddCategoryId(MUSCLE_CATEGORIES[0]!.id);
                  setSheetOpen(true);
                }}
                variant="outline"
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                <Plus className="mr-2 h-4 w-4" />
                Dodaj ćwiczenie
              </Button>
            </div>

            {plan.exercises.length === 0 ? (
              <div className="glass-panel rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-white/55">
                Nie dodano jeszcze żadnego ćwiczenia. Wybierz partię i ruch z
                listy lub wpisz własne ćwiczenie.
              </div>
            ) : (
              <ul className="space-y-3">
                {plan.exercises.map((ex, idx) => (
                  <motion.li
                    key={ex.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--neon)]">
                        {categoryLabel(ex.categoryId)}
                      </p>
                      <p className="mt-1 truncate font-medium text-white">
                        <span className="text-white/45">{idx + 1}. </span>
                        {ex.name}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`reps-${ex.id}`}
                          className="whitespace-nowrap text-xs text-white/55"
                        >
                          Powtórzenia
                        </Label>
                        <Input
                          id={`reps-${ex.id}`}
                          type="number"
                          min={1}
                          max={999}
                          value={ex.reps}
                          onChange={(e) => {
                            const n = Number.parseInt(e.target.value, 10);
                            if (!Number.isFinite(n) || n < 1) return;
                            updateExercise(ex.id, { reps: n });
                          }}
                          className="h-9 w-20 border-white/15 bg-black/25 text-center text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeExercise(ex.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-white/60 transition hover:border-white/20 hover:text-white"
                        aria-label="Usuń ćwiczenie"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Dodaj ćwiczenie</SheetTitle>
            <SheetDescription>
              Wyszukiwarka rozumie nazwy po polsku i po angielsku — w planie
              zapisuje się polska nazwa z katalogu (np. „Single arm cable row” →
              wiosłowanie na wyciągu). Możesz też dodać własną nazwę, jeśli nie
              ma jej w słowniku.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4">
            <div>
              <Label htmlFor="cat" className="text-white/80">
                Partia / kategoria
              </Label>
              <select
                id="cat"
                value={addCategoryId}
                onChange={(e) => setAddCategoryId(e.target.value)}
                className="mt-2 flex h-10 w-full rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white outline-none ring-[var(--neon)]/30 focus:ring-2"
              >
                {MUSCLE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-white/45">
                Partie obejmują m.in.: klatkę, górę/środek/dół pleców, barki,
                biceps, triceps, przedramiona, core, uda (przód/tył), pośladki,
                łydki i cardio.
              </p>
            </div>

            <div>
              <Label htmlFor="search-ex" className="text-white/80">
                Szukaj na liście
              </Label>
              <div className="relative mt-2">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/35" />
                <Input
                  id="search-ex"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Np. bench press, wyciskanie, cable row…"
                  className="h-10 border-white/15 bg-black/25 pl-9 text-white placeholder:text-white/35"
                />
              </div>
            </div>

            <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-2">
              {filteredCatalog.map((item) => {
                const otherPart =
                  item.categoryId !== addCategoryId
                    ? categoryLabel(item.categoryId)
                    : null;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addFromCatalog(item.name, item.categoryId)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left text-sm text-white/85 transition hover:bg-white/10",
                    )}
                  >
                    <span>{item.name}</span>
                    {otherPart ? (
                      <span className="text-[11px] text-white/45">
                        Partia: {otherPart}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {filteredCatalog.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-white/45">
                  Brak wyników — zmień wyszukiwanie lub dodaj własne ćwiczenie
                  poniżej.
                </p>
              ) : null}
            </div>

            {customNamesForCategory.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-white/55">
                  Twoje wcześniej dodane (wszystkie kategorie)
                </p>
                <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/15 p-2">
                  {customNamesForCategory.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => addFromCatalog(name, addCategoryId)}
                      className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-dashed border-white/20 bg-black/20 p-4">
              <button
                type="button"
                onClick={() => setShowCustomRow((v) => !v)}
                className="text-sm font-medium text-[var(--neon)]"
              >
                {showCustomRow ? "Ukryj" : "Dodaj własne ćwiczenie"}
              </button>
              {showCustomRow ? (
                <div className="mt-3 space-y-2">
                  <Input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Po polsku lub angielsku — dopasujemy do katalogu"
                    className="h-10 border-white/15 bg-black/25 text-white placeholder:text-white/35"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addCustomExercise();
                    }}
                  />
                  {customMatchPreview ? (
                    <p className="text-xs text-white/55">
                      Rozpoznano:{" "}
                      <span className="font-medium text-[var(--neon)]">
                        {customMatchPreview.name}
                      </span>
                      {" · "}
                      {categoryLabel(customMatchPreview.categoryId)}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    onClick={addCustomExercise}
                    disabled={!customName.trim()}
                    className="bg-[var(--neon)] text-white hover:bg-[#ff4d6d]"
                  >
                    {customMatchPreview
                      ? "Dodaj rozpoznane ćwiczenie"
                      : `Dodaj do planu (partia: ${categoryLabel(addCategoryId)})`}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <SheetFooter className="px-4 pb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSheetOpen(false)}
              className="w-full border-white/15"
            >
              Zamknij
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
