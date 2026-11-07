"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useScroll, useTransform } from "framer-motion";
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
  dietDiarySlotFromHour,
  type DietDiarySlot,
} from "@/lib/diet-diary-slots";
import {
  buildMealPlanRows,
  MEAL_PLAN_DIARY_SLOTS,
} from "@/lib/diet-recipe-match";
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
import { AlertCircle, Pencil, Trash2, X } from "lucide-react";
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
  calories,
  remainingKcal,
  onDone,
}: {
  id: string;
  name?: string | null;
  calories?: number;
  remainingKcal?: number | null;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    deleteMealLogFormAction,
    {} as MealLogFormState,
  );
  const { notifySaved, notifyError } = useSaveFeedback();
  const handledStateRef = useRef<MealLogFormState | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!state || state === handledStateRef.current) return;
    if (state.ok) {
      handledStateRef.current = state;
      notifySaved("Usunięto produkt z dziennika.");
      setOpen(false);
      onDoneRef.current();
    } else if (state.error) {
      handledStateRef.current = state;
      notifyError(state.error);
    }
  }, [state, notifySaved, notifyError]);

  return (
    <>
      <button
        type="button"
        className="inline-flex h-11 w-9 items-center justify-center rounded-lg text-white/40 transition-colors hover:text-rose-300 active:text-rose-300"
        aria-label="Usuń"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="app-dialog left-0 top-auto bottom-0 w-full max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-[28px] px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-5">
          <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
          <span aria-hidden className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-400/10 text-rose-300"><Trash2 className="h-5 w-5" /></span>
          <AlertDialogTitle className="text-xl font-bold">Usunąć produkt?</AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-white/65">
            {name?.trim()
              ? `„${name.trim()}” zniknie z dziennika, a makro dnia zostanie przeliczone.`
              : "Wpis zniknie z dziennika, a makro dnia zostanie przeliczone."}
          </AlertDialogDescription>
          {remainingKcal != null && calories != null ? (
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-3">
              <span className="text-[13px] text-white/65">Do zjedzenia po usunięciu</span>
              <span className="text-[14px] font-semibold tabular-nums text-[var(--gym-gold)]">
                {Math.round(remainingKcal + calories)} kcal
              </span>
            </div>
          ) : null}
          <div className="mt-5 flex gap-2.5">
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
    "relative z-[1] min-h-9 rounded-full px-4 py-1.5 text-[13px] leading-none transition-colors duration-200",
    active
      ? "font-semibold text-[var(--gym-on-gold)]"
      : "font-medium text-white/65 hover:text-white/90",
  );
}

function dayKindButtonClass(active: boolean) {
  return cn(
    "min-h-10 rounded-xl px-2 text-[12px] transition-colors duration-200 disabled:opacity-60",
    active
      ? "bg-[var(--gym-gold)]/16 font-semibold text-[var(--gym-gold)] shadow-[inset_0_0_0_1px_rgba(221,187,109,0.45)]"
      : "font-medium text-white/55 hover:text-white/80",
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
  initialTab = "diary",
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

  const [dayError, setDayError] = useState<string | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const dateKeyRef = useRef(dateKey);
  dateKeyRef.current = dateKey;

  const refreshDay = useCallback(
    (key: string) => {
      const switching = key !== dateKeyRef.current;
      if (switching) setDayLoading(true);
      start(async () => {
        const r = await loadDietDayAction(key);
        setDayLoading(false);
        if (!r.ok) {
          setDayError(r.error ?? "Nie udało się wczytać dnia.");
          notifyError(r.error);
          return;
        }
        setDayError(null);
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

  const mealPlanRows = useMemo(
    () =>
      buildMealPlanRows(mealTemplates, {
        proteinGoal: dayMacros.proteinGoal,
        carbsGoal: dayMacros.carbsGoal,
        fatGoal: dayMacros.fatGoal,
        caloriesGoal: dayMacros.caloriesGoal,
      }),
    [
      mealTemplates,
      dayMacros.proteinGoal,
      dayMacros.carbsGoal,
      dayMacros.fatGoal,
      dayMacros.caloriesGoal,
    ],
  );

  const addSlotCaloriesGoal = useMemo(() => {
    if (!addSlot) return null;
    const row = mealPlanRows.find((r) => r.diarySlot === addSlot);
    return row?.calories ?? null;
  }, [addSlot, mealPlanRows]);

  const openScan = useCallback((slot: DietDiarySlot) => {
    setScanSlot(slot);
    setScanOpen(true);
  }, []);

  /** Wejście z pulpitu: ?tab=diary&scan=1 → od razu aparat; ?add=1 → ekran dodawania. */
  useEffect(() => {
    const openScanDeepLink = searchParams.get("scan") === "1";
    const openAddDeepLink = searchParams.get("add") === "1";
    if (!openScanDeepLink && !openAddDeepLink) return;

    const slot = dietDiarySlotFromHour(new Date().getHours());
    if (openScanDeepLink) {
      setScanSlot(slot);
      setScanOpen(true);
    } else {
      setAddSlot(slot);
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("scan");
    params.delete("add");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [searchParams, router]);

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

  const isDiary = tab === "diary";
  const isPlan = tab === "plan";
  const { scrollY } = useScroll();
  const ambientY = useTransform(scrollY, [0, 280], [0, 10]);

  return (
    <div
      className={cn(
        "relative -mx-1 flex min-h-[calc(100dvh-8rem)] flex-col overflow-x-clip bg-black",
        "pb-[calc(6.75rem+env(safe-area-inset-bottom))]",
      )}
    >
      <motion.div
        aria-hidden
        style={{ y: ambientY }}
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[420px]"
      >
        <div
          className="absolute -left-24 -top-16 h-72 w-72 rounded-full blur-[100px]"
          style={{
            background: "rgba(221, 187, 109, 0.045)",
          }}
        />
        <div
          className="absolute -right-20 -top-10 h-80 w-80 rounded-full blur-[110px]"
          style={{
            background: "rgba(90, 140, 220, 0.04)",
          }}
        />
      </motion.div>

      <header className="relative z-[1] space-y-3 px-1 pt-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p
              className={cn(
                appPageKickerClass,
                "truncate tracking-[0.16em] text-[var(--gym-gold)]/85",
              )}
            >
              {isPlan ? "Pomysły na dziś" : "Co jesz"}
            </p>
            <h1 className={cn(appPageTitleClass, "mt-1 text-white")}>
              {isPlan ? "Przepisy" : "Dziennik"}
            </h1>
          </div>

          <div className="relative grid shrink-0 grid-cols-2 rounded-full border border-white/[0.1] bg-white/[0.04] p-1">
            <motion.span
              aria-hidden
              className="absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-gradient-to-b from-[#F5E4A3] via-[#E4C56D] to-[#D1A84A] shadow-[0_2px_12px_rgba(221,187,109,0.35)]"
              initial={false}
              animate={{ left: isDiary ? 4 : "calc(50%)" }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
            />
            <button
              type="button"
              onClick={() => setTab("diary")}
              aria-pressed={isDiary}
              className={tabButtonClass(isDiary)}
            >
              {t("diet.tabDiary")}
            </button>
            <button
              type="button"
              onClick={() => setTab("plan")}
              aria-pressed={isPlan}
              className={tabButtonClass(isPlan)}
            >
              {t("diet.tabPlan")}
            </button>
          </div>
        </div>

        {isDiary ? (
          <DietDateNav dateKey={dateKey} onSelect={(k) => refreshDay(k)} />
        ) : null}

        <div
          role="group"
          aria-label="Rodzaj dnia"
          className={cn(
            "grid gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1",
            isDiary ? "grid-cols-3" : "grid-cols-2",
          )}
        >
          {(isDiary
            ? ([
                { id: "training", label: "Treningowy", active: dayKindChoice === "training", onClick: () => setDayKindOptimistic("training") },
                { id: "rest", label: "Nietreningowy", active: dayKindChoice === "rest", onClick: () => setDayKindOptimistic("rest") },
                { id: "default", label: "Domyślnie", active: dayKindChoice === "default", onClick: clearDayKindOptimistic },
              ] as const)
            : ([
                { id: "training", label: "Treningowy", active: dayKindChoice === "training", onClick: () => setDayKindOptimistic("training") },
                { id: "rest", label: "Nietreningowy", active: dayKindChoice === "rest" || dayKindChoice === "default", onClick: () => setDayKindOptimistic("rest") },
              ] as const)
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={pending}
              aria-pressed={o.active}
              onClick={o.onClick}
              className={dayKindButtonClass(o.active)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </header>

      <div
        key={`${tab}-${dateKey}`}
        className="relative z-[1] mt-3 min-h-0 flex-1 px-1 pb-8"
      >
        {tab === "plan" ? (
          <DietMealPlanPanel
            mealTemplates={mealTemplates}
            catalogMeals={catalogMeals}
            dateKey={dateKey}
            dayKind={dayKind}
            dayMacros={{
              caloriesConsumed: dayMacros.caloriesConsumed,
              caloriesGoal: dayMacros.caloriesGoal,
              proteinConsumed: dayMacros.proteinConsumed,
              proteinGoal: dayMacros.proteinGoal,
              carbsConsumed: dayMacros.carbsConsumed,
              carbsGoal: dayMacros.carbsGoal,
              fatConsumed: dayMacros.fatConsumed,
              fatGoal: dayMacros.fatGoal,
            }}
            supplements={supplements}
            weeklyCardioGoalMinutes={weeklyCardioGoalMinutes}
          />
        ) : (
          <>
            {dayError ? (
              <div
                role="alert"
                className="mb-3 flex items-start gap-2.5 rounded-2xl border border-rose-400/35 bg-rose-400/[0.08] px-3.5 py-3"
              >
                <AlertCircle
                  className="mt-0.5 h-[18px] w-[18px] shrink-0 text-rose-300"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-white">
                    Nie udało się wczytać dnia
                  </p>
                  <p className="mt-0.5 text-[13px] text-white/70">
                    Sprawdź połączenie i spróbuj ponownie.
                  </p>
                  <button
                    type="button"
                    onClick={() => refreshDay(dateKey)}
                    className="mt-1 min-h-9 text-[13px] font-semibold text-rose-300"
                  >
                    Spróbuj ponownie
                  </button>
                </div>
              </div>
            ) : null}
            {dayLoading ? (
              <div aria-hidden className="space-y-3">
                <div className="h-[150px] animate-pulse rounded-[20px] bg-white/[0.06]" />
                <div className="h-24 animate-pulse rounded-[20px] bg-white/[0.06]" />
                <div className="h-24 animate-pulse rounded-[20px] bg-white/[0.06]" />
              </div>
            ) : (
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
            )}

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
                        <p className="text-xs tabular-nums text-white/50">
                          {Math.round(e.calories)} kcal
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Edytuj wpis"
                        onClick={() => setEditingLog(e)}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/50 hover:bg-white/[0.06] hover:text-white"
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
        slotCaloriesGoal={addSlotCaloriesGoal}
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
        <div className="fixed inset-0 z-[170] overflow-y-auto bg-black pb-10">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.07] bg-black/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
            <p className="text-[17px] font-semibold text-white">Wybierz potrawę</p>
            <button
              type="button"
              aria-label="Zamknij"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] text-white/80"
              onClick={() => {
                setDishPickerOpen(false);
                setDishPickerSlot(null);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-3 pt-3">
          <MealCatalogBrowser
            dateKey={dateKey}
            meals={catalogMeals}
            isAdmin={isAdmin}
            defaultDiarySlot={dishPickerSlot}
          />
          </div>
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
        onSlotChange={setPortionSlot}
        pending={pending}
        mealTemplates={mealTemplates}
        dayMacros={dayMacros}
        slotEaten={(() => {
          const entries = bySlot[portionSlot] ?? [];
          return {
            proteinG: entries.reduce((s, e) => s + e.proteinG, 0),
            carbsG: entries.reduce((s, e) => s + e.carbsG, 0),
            fatG: entries.reduce((s, e) => s + e.fatG, 0),
            calories: entries.reduce((s, e) => s + e.calories, 0),
          };
        })()}
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
              `Dodano „${product.name}” (${macros.label}) do Posiłek ${
                MEAL_PLAN_DIARY_SLOTS.indexOf(portionSlot) + 1
              }.`,
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
