"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  loadDietDayAction,
  setDietDayKindAction,
} from "@/actions/diet-day";
import { addMealProductAction, deleteMealLogFormAction, type MealLogFormState } from "@/actions/meal-log";
import { MealCatalogBrowser } from "@/components/meal-suggestions/meal-catalog-browser";
import { MealSuggestionsTodayCard } from "@/components/meal-suggestions/meal-suggestions-today-card";
import { EditMealLogSheet } from "@/components/meal-suggestions/edit-meal-log-sheet";
import { AddMealScreen } from "@/components/meal-suggestions/add-meal-screen";
import { FoodPortionScreen } from "@/components/meal-suggestions/food-portion-screen";
import { DietWeekStrip } from "@/components/meal-suggestions/diet-week-strip";
import { DietMealPlanPanel } from "@/components/meal-suggestions/diet-meal-plan-panel";
import { DietDayMacrosBar } from "@/components/meal-suggestions/diet-day-macros-bar";
import {
  DIET_DIARY_SLOT_LABELS,
  type DietDiarySlot,
} from "@/lib/diet-diary-slots";
import type { FoodProduct } from "@/lib/food-products-types";
import type { MealLogDto } from "@/lib/meal-logs";
import type { MacroGaps } from "@/lib/meal-suggestions-gaps";
import type { FitatuDaySummary } from "@/types/fitatu";
import type { MealTemplate } from "@/lib/meal-templates";
import type { CatalogMeal } from "@/lib/meal-catalog-types";
import type { NutritionDayType } from "@/lib/nutrition-goals";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { useActionState, useEffect } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { calendarDateKey } from "@/lib/local-date";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useOverlayHistoryBack } from "@/hooks/use-overlay-history-back";
import { useI18n } from "@/components/i18n/i18n-provider";
import { AppPageHeader } from "@/components/layout/screen";

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
        <AlertDialogContent className="app-dialog p-6">
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

export function MealSuggestionsView({
  initialSummary: _initialSummary,
  initialGaps,
  initialLogs,
  initialDayKind = "rest",
  mealTemplates = [],
  catalogMeals = [],
  isAdmin = false,
}: {
  initialSummary: FitatuDaySummary;
  initialGaps: MacroGaps;
  initialLogs: MealLogDto[];
  initialDayKind?: NutritionDayType;
  mealTemplates?: MealTemplate[];
  catalogMeals?: CatalogMeal[];
  isAdmin?: boolean;
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
  const [addSlot, setAddSlot] = useState<DietDiarySlot | null>(null);
  const [dishPickerOpen, setDishPickerOpen] = useState(false);
  const [dishPickerSlot, setDishPickerSlot] = useState<DietDiarySlot | null>(null);
  const [portionProduct, setPortionProduct] = useState<FoodProduct | null>(null);
  const [portionSlot, setPortionSlot] = useState<DietDiarySlot>("sniadanie");
  const [focusMealId, setFocusMealId] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<MealLogDto | null>(null);
  const { t } = useI18n();

  const mealOverlayOpen =
    Boolean(addSlot) || Boolean(portionProduct) || dishPickerOpen;
  useOverlayHistoryBack(mealOverlayOpen, () => {
    if (portionProduct) {
      setPortionProduct(null);
      return;
    }
    if (dishPickerOpen) {
      setDishPickerOpen(false);
      setDishPickerSlot(null);
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
    <div className="relative -mx-1 flex min-h-[calc(100dvh-8rem)] flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <AppPageHeader
        kicker="Dieta"
        title="Jadłospis"
        description={dateLabel}
        className="px-1"
      />
      <div className="flex gap-2 px-1 pt-1">
        <button
          type="button"
          onClick={() => setTab("plan")}
          className={
            tab === "plan"
              ? "rounded-full border border-[var(--neon)]/50 bg-[var(--neon)]/20 px-5 py-2 text-sm font-semibold text-white"
              : "rounded-full border border-white/12 bg-white/[0.04] px-5 py-2 text-sm font-medium text-white/55"
          }
        >
          {t("diet.tabPlan")}
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
          {t("diet.tabDiary")}
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
          <MealSuggestionsTodayCard
            gaps={gaps}
            catalogMeals={catalogMeals}
            onSelectMeal={(meal) => setFocusMealId(meal.id)}
          />
          <MealCatalogBrowser
            dateKey={dateKey}
            meals={catalogMeals}
            isAdmin={isAdmin}
            focusMealId={focusMealId}
            onFocusMealHandled={() => setFocusMealId(null)}
          />
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
                  ? "rounded-full border border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--gym-gold)]"
                  : "rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-white/55"
              }
            >
              Dzień treningowy
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
                  ? "rounded-full border border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--gym-gold)]"
                  : "rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-white/55"
              }
            >
              Nietreningowy
            </button>
          </div>

          <div
            key={dateKey}
            className="mt-3 min-h-0 flex-1 animate-page-enter-opacity px-1 pb-6"
          >
            <DietMealPlanPanel
              mealTemplates={mealTemplates}
              catalogMeals={catalogMeals}
              dateKey={dateKey}
              dayMacros={{
                proteinGoal: dayMacros.proteinGoal,
                carbsGoal: dayMacros.carbsGoal,
                fatGoal: dayMacros.fatGoal,
                caloriesGoal: dayMacros.caloriesGoal,
              }}
              bySlot={bySlot}
              onAddManual={(slot) => setAddSlot(slot)}
              onEditLog={(entry) => setEditingLog(entry)}
              onDeleted={() => refreshDay(dateKey)}
              DeleteMealButton={DeleteMealButton}
            />

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
                      <button
                        type="button"
                        aria-label="Edytuj wpis"
                        onClick={() => setEditingLog(e)}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/45 hover:bg-white/[0.06] hover:text-white"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
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

      <AddMealScreen
        open={Boolean(addSlot)}
        slot={addSlot ?? "sniadanie"}
        dateKey={dateKey}
        dateLabel={dateLabel}
        onClose={() => setAddSlot(null)}
        onOpenDish={() => {
          setDishPickerSlot(addSlot);
          setAddSlot(null);
          setDishPickerOpen(true);
        }}
        onSaved={() => {
          refreshDay(dateKey);
          router.refresh();
        }}
        onPickProduct={(product) => {
          if (!addSlot) return;
          setPortionSlot(addSlot);
          setPortionProduct(product);
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
              onClick={() => {
                setDishPickerOpen(false);
                setDishPickerSlot(null);
              }}
            >
              Zamknij
            </button>
          </div>
          <MealCatalogBrowser
            dateKey={dateKey}
            meals={catalogMeals}
            isAdmin={isAdmin}
            defaultDiarySlot={dishPickerSlot}
          />
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
      <EditMealLogSheet
        key={editingLog?.id ?? "closed"}
        entry={editingLog}
        open={Boolean(editingLog)}
        onOpenChange={(next) => {
          if (!next) setEditingLog(null);
        }}
        onSaved={() => {
          setEditingLog(null);
          refreshDay(dateKey);
          router.refresh();
        }}
      />

      {/* Sticky makro dnia nad dolną belką — ile zjedzono / zostało do celu. */}
      {!mealOverlayOpen ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-40 pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
          <div className="pointer-events-auto mx-auto max-w-lg">
            <DietDayMacrosBar {...dayMacros} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
