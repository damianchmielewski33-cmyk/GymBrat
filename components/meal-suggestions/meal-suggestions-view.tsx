"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  clearDietDayKindAction,
  loadDietDayAction,
  setDietDayKindAction,
} from "@/actions/diet-day";
import {
  addMealProductAction,
  deleteMealLogFormAction,
  type MealLogFormState,
} from "@/actions/meal-log";
import { lookupFoodByBarcodeAction } from "@/actions/food-lookup";
import { MealCatalogBrowser } from "@/components/meal-suggestions/meal-catalog-browser";
import { EditMealLogSheet } from "@/components/meal-suggestions/edit-meal-log-sheet";
import { AddMealScreen } from "@/components/meal-suggestions/add-meal-screen";
import { FoodPortionScreen } from "@/components/meal-suggestions/food-portion-screen";
import { DietDateNav } from "@/components/meal-suggestions/diet-date-nav";
import { DietMealPlanPanel } from "@/components/meal-suggestions/diet-meal-plan-panel";
import { DietDiaryPanel } from "@/components/meal-suggestions/diet-diary-panel";
import { BarcodeCameraScanner } from "@/components/meal-suggestions/barcode-camera-scanner";
import {
  DIET_DIARY_SLOT_LABELS,
  dietDiarySlotFromHour,
  type DietDiarySlot,
} from "@/lib/diet-diary-slots";
import type { FoodProduct } from "@/lib/food-products-types";
import type { MealLogDto } from "@/lib/meal-logs";
import type { MacroGaps } from "@/lib/meal-suggestions-gaps";
import type { FitatuDaySummary } from "@/types/fitatu";
import type { MealTemplate } from "@/lib/meal-templates";
import type { CatalogMeal } from "@/lib/meal-catalog-types";
import type { DietSupplement } from "@/lib/diet-supplements";
import type { NutritionDayType } from "@/lib/nutrition-goals";
import { parseDietTab, type DietTabId } from "@/lib/diet-tabs";
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
import { appPageKickerClass, appPageTitleClass } from "@/components/layout/screen";
import { cn } from "@/lib/utils";

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

function tabButtonClass(active: boolean) {
  return cn(
    "rounded-full border px-4 py-1.5 text-[13px] leading-none",
    active
      ? "border-[#6b5428] bg-[#5a4320] font-semibold text-[var(--gym-gold)]"
      : "border-white/25 bg-transparent font-medium text-white/80",
  );
}

function dayKindButtonClass(active: boolean) {
  return cn(
    "rounded-full border px-3.5 py-1.5 text-[12px]",
    active
      ? "border-[var(--gym-gold)]/55 bg-transparent font-semibold text-[var(--gym-gold)]"
      : "border-white/18 bg-transparent font-medium text-white/55",
  );
}

type DayKindChoice = NutritionDayType | "default";

export function MealSuggestionsView({
  initialSummary: _initialSummary,
  initialGaps,
  initialLogs,
  initialDayKind = "rest",
  initialDayKindExplicit = false,
  mealTemplates = [],
  catalogMeals = [],
  isAdmin = false,
  supplements = [],
  weeklyCardioGoalMinutes = 150,
  initialTab = "plan",
}: {
  initialSummary: FitatuDaySummary;
  initialGaps: MacroGaps;
  initialLogs: MealLogDto[];
  initialDayKind?: NutritionDayType;
  initialDayKindExplicit?: boolean;
  mealTemplates?: MealTemplate[];
  catalogMeals?: CatalogMeal[];
  isAdmin?: boolean;
  supplements?: DietSupplement[];
  weeklyCardioGoalMinutes?: number;
  initialTab?: DietTabId;
}) {
  void _initialSummary;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notifySaved, notifyError } = useSaveFeedback();
  const { t } = useI18n();

  const tab = parseDietTab(searchParams.get("tab") ?? initialTab);

  const setTab = useCallback(
    (next: DietTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const [dateKey, setDateKey] = useState(initialGaps.dateKey);
  const [gaps, setGaps] = useState(initialGaps);
  const [logs, setLogs] = useState(initialLogs);
  const [dayKind, setDayKind] = useState<NutritionDayType>(initialDayKind);
  const [dayKindChoice, setDayKindChoice] = useState<DayKindChoice>(
    initialDayKindExplicit ? initialDayKind : "default",
  );
  const [pending, start] = useTransition();
  const [addSlot, setAddSlot] = useState<DietDiarySlot | null>(null);
  const [dishPickerOpen, setDishPickerOpen] = useState(false);
  const [dishPickerSlot, setDishPickerSlot] = useState<DietDiarySlot | null>(
    null,
  );
  const [portionProduct, setPortionProduct] = useState<FoodProduct | null>(
    null,
  );
  const [portionSlot, setPortionSlot] = useState<DietDiarySlot>("sniadanie");
  const [editingLog, setEditingLog] = useState<MealLogDto | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanSlot, setScanSlot] = useState<DietDiarySlot>("sniadanie");
  const [scanBusy, setScanBusy] = useState(false);

  const mealOverlayOpen =
    Boolean(addSlot) ||
    Boolean(portionProduct) ||
    dishPickerOpen ||
    scanOpen;
  useOverlayHistoryBack(mealOverlayOpen, () => {
    if (scanOpen) {
      setScanOpen(false);
      return;
    }
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
        setDayKindChoice(
          r.data.dayKindExplicit ? r.data.dayKind : "default",
        );
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
  const defaultScanSlot = dietDiarySlotFromHour(new Date().getHours());

  const dayMacros = {
    caloriesConsumed: gaps.caloriesConsumed,
    caloriesGoal: gaps.caloriesGoal,
    proteinConsumed: gaps.proteinConsumed,
    proteinGoal: gaps.proteinGoal,
    fatConsumed: gaps.fatConsumed,
    fatGoal: gaps.fatGoal,
    carbsConsumed: gaps.carbsConsumed,
    carbsGoal: gaps.carbsGoal,
    caloriesRemaining: gaps.caloriesRemaining,
  };

  const openScan = useCallback((slot: DietDiarySlot) => {
    setScanSlot(slot);
    setScanOpen(true);
  }, []);

  const onBarcode = useCallback(
    (code: string) => {
      setScanOpen(false);
      setScanBusy(true);
      start(async () => {
        try {
          const r = await lookupFoodByBarcodeAction(code);
          if (!r.ok) {
            notifyError(r.error);
            setPortionSlot(scanSlot);
            setAddSlot(scanSlot);
            return;
          }
          setPortionSlot(scanSlot);
          setPortionProduct(r.product);
        } finally {
          setScanBusy(false);
        }
      });
    },
    [notifyError, scanSlot],
  );

  const setDayKindOptimistic = useCallback(
    (kind: NutritionDayType) => {
      start(async () => {
        const r = await setDietDayKindAction(dateKey, kind);
        if (!r.ok) {
          notifyError(r.error);
          return;
        }
        setDayKind(kind);
        setDayKindChoice(kind);
        refreshDay(dateKey);
      });
    },
    [dateKey, notifyError, refreshDay],
  );

  const clearDayKindOptimistic = useCallback(() => {
    start(async () => {
      const r = await clearDietDayKindAction(dateKey);
      if (!r.ok) {
        notifyError(r.error);
        return;
      }
      setDayKindChoice("default");
      refreshDay(dateKey);
    });
  }, [dateKey, notifyError, refreshDay]);

  const dayKindKicker =
    dayKind === "training" ? "DZIEŃ TRENINGOWY" : "DZIEŃ NIETRENINGOWY";
  const kcalKicker =
    dayMacros.caloriesGoal != null
      ? `${Math.round(dayMacros.caloriesGoal)} KCAL`
      : null;

  return (
    <div
      className={cn(
        "relative -mx-1 flex min-h-[calc(100dvh-8rem)] flex-col",
        "pb-[calc(5.5rem+env(safe-area-inset-bottom))]",
      )}
    >
      <header className="space-y-3 px-1 pt-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {tab === "plan" ? (
              <>
                <p className={appPageKickerClass}>
                  {dayKindKicker}
                  {kcalKicker ? ` · ${kcalKicker}` : ""}
                </p>
                <h1 className={cn(appPageTitleClass, "mt-1.5")}>Twój plan</h1>
              </>
            ) : (
              <>
                <p className={appPageKickerClass}>Co zjadłeś</p>
                <h1
                  className={cn(
                    "mt-1.5 font-metric text-[34px] font-normal leading-none tracking-tight text-white",
                  )}
                >
                  Dziennik
                </h1>
              </>
            )}
          </div>
          <div className="mt-5 flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => setTab("plan")}
              className={tabButtonClass(tab === "plan")}
            >
              {t("diet.tabPlan")}
            </button>
            <button
              type="button"
              onClick={() => setTab("diary")}
              className={tabButtonClass(tab === "diary")}
            >
              {t("diet.tabDiary")}
            </button>
          </div>
        </div>

        {tab === "diary" ? (
          <DietDateNav dateKey={dateKey} onSelect={(k) => refreshDay(k)} />
        ) : null}

        {tab === "plan" ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setDayKindOptimistic("training")}
              className={dayKindButtonClass(dayKindChoice === "training")}
            >
              Dzień treningowy
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setDayKindOptimistic("rest")}
              className={dayKindButtonClass(
                dayKindChoice === "rest" || dayKindChoice === "default",
              )}
            >
              Nietreningowy
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setDayKindOptimistic("training")}
              className={dayKindButtonClass(dayKindChoice === "training")}
            >
              Treningowy
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setDayKindOptimistic("rest")}
              className={dayKindButtonClass(dayKindChoice === "rest")}
            >
              Nietreningowy
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={clearDayKindOptimistic}
              className={dayKindButtonClass(dayKindChoice === "default")}
            >
              domyślnie
            </button>
          </div>
        )}
      </header>

      <div
        key={`${tab}-${dateKey}`}
        className="mt-4 min-h-0 flex-1 animate-page-enter-opacity px-1 pb-6"
      >
        {tab === "plan" ? (
          <DietMealPlanPanel
            mealTemplates={mealTemplates}
            catalogMeals={catalogMeals}
            dateKey={dateKey}
            dayKind={dayKind}
            dayMacros={{
              proteinGoal: dayMacros.proteinGoal,
              carbsGoal: dayMacros.carbsGoal,
              fatGoal: dayMacros.fatGoal,
              caloriesGoal: dayMacros.caloriesGoal,
            }}
            supplements={supplements}
            weeklyCardioGoalMinutes={weeklyCardioGoalMinutes}
          />
        ) : (
          <>
            <DietDiaryPanel
              bySlot={bySlot}
              dayMacros={dayMacros}
              mealTemplates={mealTemplates}
              defaultScanSlot={defaultScanSlot}
              onScan={openScan}
              onOpenCatalog={(slot) => {
                setDishPickerSlot(slot);
                setDishPickerOpen(true);
              }}
              onAddManual={(slot) => setAddSlot(slot)}
              onEditLog={(entry) => setEditingLog(entry)}
              onDeleted={() => refreshDay(dateKey)}
              DeleteMealButton={DeleteMealButton}
            />

            {unassigned.length > 0 ? (
              <section className="mt-3 space-y-2 opacity-80">
                <h2 className="text-sm font-semibold text-white/70">
                  Bez sekcji
                </h2>
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
          </>
        )}
      </div>

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

      <BarcodeCameraScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={onBarcode}
      />

      {scanBusy ? (
        <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/60 text-sm text-white/80">
          Szukam produktu…
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
    </div>
  );
}
