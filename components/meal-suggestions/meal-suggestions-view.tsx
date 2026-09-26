"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  loadDietDayAction,
  setDietDayKindAction,
} from "@/actions/diet-day";
import { addMealProductAction, deleteMealLogFormAction, type MealLogFormState } from "@/actions/meal-log";
import { AddMealChoiceBar } from "@/components/meal-suggestions/add-meal-choice-bar";
import { MealCatalogBrowser } from "@/components/meal-suggestions/meal-catalog-browser";
import { AddMealScreen } from "@/components/meal-suggestions/add-meal-screen";
import { FoodPortionScreen } from "@/components/meal-suggestions/food-portion-screen";
import { DietWeekStrip } from "@/components/meal-suggestions/diet-week-strip";
import { DietDayMacrosBar } from "@/components/meal-suggestions/diet-day-macros-bar";
import {
  DIET_DIARY_SLOT_LABELS,
  DIET_DIARY_SLOTS,
  type DietDiarySlot,
} from "@/lib/diet-diary-slots";
import type { FoodProduct } from "@/lib/food-products-types";
import type { MealLogDto } from "@/lib/meal-logs";
import type { MacroGaps } from "@/lib/meal-suggestions-gaps";
import type { FitatuDaySummary } from "@/types/fitatu";
import type { MealTemplate } from "@/lib/meal-templates";
import type { NutritionDayType } from "@/lib/nutrition-goals";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { useActionState, useEffect } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { calendarDateKey } from "@/lib/local-date";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useOverlayHistoryBack } from "@/hooks/use-overlay-history-back";

function formatDateLabel(dateKey: string): string {
  const today = calendarDateKey();
  if (dateKey === today) return "Dzisiaj";
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function DeleteMealButton({
  id,
  name,
  onDone,
}: {
  id: string;
  name?: string | null;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    deleteMealLogFormAction,
    {} as MealLogFormState,
  );
  const { notifySaved, notifyError } = useSaveFeedback();

  useEffect(() => {
    if (state?.ok) {
      notifySaved("Usunięto produkt z dziennika.");
      setOpen(false);
      onDone();
    } else if (state?.error) {
      notifyError(state.error);
    }
  }, [state, notifySaved, notifyError, onDone]);

  return (
    <>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/10 hover:text-rose-200"
        aria-label="Usuń"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="border border-white/10 bg-[#0c0c0c] p-6">
          <AlertDialogTitle>Usunąć produkt?</AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-white/65">
            {name?.trim()
              ? `„${name.trim()}” zniknie z dziennika, a makro dnia zostanie przeliczone.`
              : "Wpis zniknie z dziennika, a makro dnia zostanie przeliczone."}
          </AlertDialogDescription>
          <div className="mt-6 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Anuluj
            </Button>
            <form action={action} className="flex-1">
              <input type="hidden" name="id" value={id} />
              <Button
                type="submit"
                className="w-full border-rose-400/30 bg-rose-500/90 text-white hover:bg-rose-500"
                disabled={pending}
              >
                {pending ? "Usuwam…" : "Usuń"}
              </Button>
            </form>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function MealSectionRow({
  slot,
  items,
  expanded,
  onToggle,
  onAdd,
  onDeleted,
}: {
  slot: DietDiarySlot;
  items: MealLogDto[];
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onDeleted: () => void;
}) {
  const sumK = items.reduce((s, e) => s + e.calories, 0);
  const sumP = items.reduce((s, e) => s + e.proteinG, 0);
  const sumF = items.reduce((s, e) => s + e.fatG, 0);
  const sumC = items.reduce((s, e) => s + e.carbsG, 0);

  return (
    <section className="border-b border-white/[0.06]">
      <div className="flex items-center gap-2 px-1 py-3.5">
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[17px] font-semibold text-white">
              {DIET_DIARY_SLOT_LABELS[slot]}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-white/40 transition",
                expanded && "rotate-180",
              )}
            />
          </div>
          <p className="mt-0.5 text-sm tabular-nums text-white/50">
            {Math.round(sumK)} kcal
          </p>
          {items.length > 0 ? (
            <p className="mt-0.5 text-[11px] tabular-nums text-white/35">
              {Math.round(sumP * 10) / 10} / {Math.round(sumF * 10) / 10} /{" "}
              {Math.round(sumC * 10) / 10}
            </p>
          ) : null}
        </button>
        <button
          type="button"
          aria-label={`Dodaj do ${DIET_DIARY_SLOT_LABELS[slot]}`}
          onClick={onAdd}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--gym-gold)] text-black shadow-[0_4px_16px_rgba(235,196,74,0.28)]"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
      </div>

      {expanded ? (
        items.length === 0 ? (
          <p className="px-1 pb-4 text-sm text-white/35">
            Brak produktów — kliknij + aby wyszukać lub zeskanować.
          </p>
        ) : (
          <ul className="space-y-1 px-1 pb-4">
            {items.map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {e.name?.trim() || "Posiłek"}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-white/45">
                    {Math.round(e.calories)} kcal · B{Math.round(e.proteinG)} W
                    {Math.round(e.carbsG)} T{Math.round(e.fatG)}
                  </p>
                </div>
                <DeleteMealButton id={e.id} name={e.name} onDone={onDeleted} />
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}

export function MealSuggestionsView({
  initialSummary: _initialSummary,
  initialGaps,
  initialLogs,
  initialDayKind = "rest",
  mealTemplates = [],
}: {
  initialSummary: FitatuDaySummary;
  initialGaps: MacroGaps;
  initialLogs: MealLogDto[];
  initialDayKind?: NutritionDayType;
  mealTemplates?: MealTemplate[];
}) {
  void _initialSummary;
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [tab, setTab] = useState<"plan" | "dziennik">("dziennik");
  const [dateKey, setDateKey] = useState(initialGaps.dateKey);
  const [gaps, setGaps] = useState(initialGaps);
  const [logs, setLogs] = useState(initialLogs);
  const [dayKind, setDayKind] = useState<NutritionDayType>(initialDayKind);
  const [pending, start] = useTransition();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addSlot, setAddSlot] = useState<DietDiarySlot | null>(null);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dishPickerOpen, setDishPickerOpen] = useState(false);
  const [portionProduct, setPortionProduct] = useState<FoodProduct | null>(null);
  const [portionSlot, setPortionSlot] = useState<DietDiarySlot>("sniadanie");

  const mealOverlayOpen =
    Boolean(addSlot) ||
    Boolean(portionProduct) ||
    choiceOpen ||
    searchOpen ||
    dishPickerOpen;
  useOverlayHistoryBack(mealOverlayOpen, () => {
    if (portionProduct) {
      setPortionProduct(null);
      return;
    }
    if (searchOpen) {
      setSearchOpen(false);
      return;
    }
    if (dishPickerOpen) {
      setDishPickerOpen(false);
      return;
    }
    if (choiceOpen) {
      setChoiceOpen(false);
      setAddSlot(null);
      return;
    }
    setAddSlot(null);
  });

  const refreshDay = useCallback(
    (key: string) => {
      start(async () => {
        const r = await loadDietDayAction(key);
        if (!r.ok) {
          notifyError(r.error);
          return;
        }
        setDateKey(r.data.dateKey);
        setGaps(r.data.gaps);
        setLogs(r.data.logs);
        setDayKind(r.data.dayKind);
      });
    },
    [notifyError],
  );

  const bySlot = useMemo(() => {
    const map: Record<DietDiarySlot, MealLogDto[]> = {
      sniadanie: [],
      drugie_sniadanie: [],
      lunch: [],
      obiad: [],
      przekaska: [],
      kolacja: [],
    };
    for (const e of logs) {
      if (e.slot && map[e.slot]) map[e.slot].push(e);
    }
    return map;
  }, [logs]);

  const unassigned = logs.filter((e) => e.slot == null);
  const dateLabel = formatDateLabel(dateKey);

  const dayMacros = {
    caloriesConsumed: gaps.caloriesConsumed,
    caloriesGoal: gaps.caloriesGoal,
    proteinConsumed: gaps.proteinConsumed,
    proteinGoal: gaps.proteinGoal,
    fatConsumed: gaps.fatConsumed,
    fatGoal: gaps.fatGoal,
    carbsConsumed: gaps.carbsConsumed,
    carbsGoal: gaps.carbsGoal,
  };

  return (
    <div className="relative -mx-1 flex min-h-[calc(100dvh-8rem)] flex-col pb-2">
      <div className="flex gap-2 px-1 pt-2">
        <button
          type="button"
          onClick={() => setTab("plan")}
          className={
            tab === "plan"
              ? "rounded-full border border-[var(--neon)]/50 bg-[var(--neon)]/20 px-5 py-2 text-sm font-semibold text-white"
              : "rounded-full border border-white/12 bg-white/[0.04] px-5 py-2 text-sm font-medium text-white/55"
          }
        >
          Plan
        </button>
        <button
          type="button"
          onClick={() => setTab("dziennik")}
          className={
            tab === "dziennik"
              ? "rounded-full border border-[var(--neon)]/50 bg-[var(--neon)]/20 px-5 py-2 text-sm font-semibold text-white"
              : "rounded-full border border-white/12 bg-white/[0.04] px-5 py-2 text-sm font-medium text-white/55"
          }
        >
          Jadłospis
        </button>
      </div>

      {tab === "plan" ? (
        <div className="mt-4 space-y-4 px-1">
          {mealTemplates.length > 0 ? (
            <section className="app-card space-y-2 p-5">
              <p className="app-label">Szablony posiłków</p>
              {mealTemplates.map((m) => (
                <div
                  key={m.id}
                  className="flex justify-between gap-3 border-b border-white/[0.05] py-2.5 last:border-0"
                >
                  <p className="text-sm text-white/85">{m.name}</p>
                  <p className="shrink-0 text-xs tabular-nums text-[var(--neon)]">
                    {Math.round(m.proteinG)}B · {Math.round(m.carbsG)}W ·{" "}
                    {Math.round(m.fatG)}T
                  </p>
                </div>
              ))}
            </section>
          ) : (
            <p className="text-sm text-white/45">
              Ustaw szablony i cele makro w profilu — tu zobaczysz plan dnia.
            </p>
          )}
          <MealCatalogBrowser dateKey={dateKey} />
        </div>
      ) : (
        <>
          <div className="mt-4 px-1">
            <DietWeekStrip dateKey={dateKey} onSelect={(k) => refreshDay(k)} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                start(async () => {
                  const r = await setDietDayKindAction(dateKey, "training");
                  if (!r.ok) {
                    notifyError(r.error);
                    return;
                  }
                  setDayKind("training");
                  refreshDay(dateKey);
                });
              }}
              className={
                dayKind === "training"
                  ? "rounded-full border border-[var(--neon)]/45 bg-[var(--neon)]/20 px-3 py-1 text-[11px] font-semibold text-white"
                  : "rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/55"
              }
            >
              Treningowy
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                start(async () => {
                  const r = await setDietDayKindAction(dateKey, "rest");
                  if (!r.ok) {
                    notifyError(r.error);
                    return;
                  }
                  setDayKind("rest");
                  refreshDay(dateKey);
                });
              }}
              className={
                dayKind === "rest"
                  ? "rounded-full border border-[var(--neon)]/45 bg-[var(--neon)]/20 px-3 py-1 text-[11px] font-semibold text-white"
                  : "rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/55"
              }
            >
              Nietreningowy
            </button>
          </div>

          <div
            key={dateKey}
            className="mt-2 min-h-0 flex-1 animate-page-enter-opacity px-1 pb-6"
          >
            {DIET_DIARY_SLOTS.map((slot) => (
              <MealSectionRow
                key={slot}
                slot={slot}
                items={bySlot[slot]}
                expanded={expanded[slot] ?? bySlot[slot].length > 0}
                onToggle={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [slot]: !(prev[slot] ?? bySlot[slot].length > 0),
                  }))
                }
                onAdd={() => {
                  setAddSlot(slot);
                  setChoiceOpen(true);
                }}
                onDeleted={() => refreshDay(dateKey)}
              />
            ))}

            {/* Kcal / makro od razu pod kolacją — nie przy dolnej belce */}
            <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
              <DietDayMacrosBar {...dayMacros} />
            </div>

            {unassigned.length > 0 ? (
              <section className="mt-3 space-y-2 opacity-80">
                <h2 className="text-sm font-semibold text-white/70">Bez sekcji</h2>
                <ul className="divide-y divide-white/[0.06] rounded-2xl border border-dashed border-white/15">
                  {unassigned.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 px-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white/80">
                          {e.name ?? "Posiłek"}
                        </p>
                        <p className="text-xs tabular-nums text-white/40">
                          {Math.round(e.calories)} kcal
                        </p>
                      </div>
                      <DeleteMealButton
                        id={e.id}
                        name={e.name}
                        onDone={() => refreshDay(dateKey)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </>
      )}

      <AddMealChoiceBar
        open={choiceOpen && Boolean(addSlot)}
        slot={addSlot ?? "sniadanie"}
        dateKey={dateKey}
        onClose={() => {
          setChoiceOpen(false);
          setAddSlot(null);
        }}
        onOpenSearch={() => {
          setChoiceOpen(false);
          setSearchOpen(true);
        }}
        onOpenDish={() => {
          setChoiceOpen(false);
          setDishPickerOpen(true);
        }}
        onSaved={() => {
          refreshDay(dateKey);
          router.refresh();
        }}
      />

      <AddMealScreen
        open={searchOpen && Boolean(addSlot)}
        slot={addSlot ?? "sniadanie"}
        dateLabel={dateLabel}
        onClose={() => {
          setSearchOpen(false);
          setAddSlot(null);
        }}
        onPickProduct={(product) => {
          if (!addSlot) return;
          setPortionSlot(addSlot);
          setPortionProduct(product);
          setSearchOpen(false);
          setAddSlot(null);
        }}
      />

      {dishPickerOpen ? (
        <div className="fixed inset-0 z-[170] overflow-y-auto bg-[#0c0c0c] px-3 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-base font-semibold text-white">Wybierz potrawę</p>
            <button
              type="button"
              className="text-sm text-white/55"
              onClick={() => setDishPickerOpen(false)}
            >
              Zamknij
            </button>
          </div>
          <MealCatalogBrowser dateKey={dateKey} />
        </div>
      ) : null}
      <FoodPortionScreen
        product={portionProduct}
        open={Boolean(portionProduct)}
        onClose={() => setPortionProduct(null)}
        slot={portionSlot}
        dateLabel={dateLabel}
        pending={pending}
        dayMacros={dayMacros}
        onConfirm={({ product, macros }) => {
          start(async () => {
            const added = await addMealProductAction({
              date: dateKey,
              slot: portionSlot,
              barcode: product.barcode,
              name: `${product.name} (${macros.label})`,
              proteinG: macros.proteinG,
              fatG: macros.fatG,
              carbsG: macros.carbsG,
              calories: macros.calories,
            });
            if (!added.ok) {
              notifyError(added.error ?? "Nie udało się dodać produktu.");
              return;
            }
            notifySaved(
              `Dodano „${product.name}” (${macros.label}) do ${DIET_DIARY_SLOT_LABELS[portionSlot]}.`,
            );
            setPortionProduct(null);
            refreshDay(dateKey);
            router.refresh();
          });
        }}
      />
    </div>
  );
}
