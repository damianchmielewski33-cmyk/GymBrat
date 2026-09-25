"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  loadDietDayAction,
  setDietDayKindAction,
} from "@/actions/diet-day";
import { addMealProductAction, deleteMealLogFormAction, type MealLogFormState } from "@/actions/meal-log";
import { lookupFoodByBarcodeAction } from "@/actions/food-lookup";
import { BarcodeCameraScanner } from "@/components/meal-suggestions/barcode-camera-scanner";
import { MealCatalogBrowser } from "@/components/meal-suggestions/meal-catalog-browser";
import { FoodSearchScan } from "@/components/meal-suggestions/food-search-scan";
import { FoodPortionSheet } from "@/components/meal-suggestions/food-portion-sheet";
import {
  DIET_DIARY_SLOT_LABELS,
  DIET_DIARY_SLOTS,
  dietDiarySlotFromHour,
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
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  ScanBarcode,
  Trash2,
} from "lucide-react";
import { calendarDateKey, addCalendarDays } from "@/lib/local-date";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatPlLong(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const today = calendarDateKey(new Date());
  const weekday = dt.toLocaleDateString("pl-PL", { weekday: "long" });
  const rest = dt.toLocaleDateString("pl-PL", { day: "numeric", month: "long" });
  if (dateKey === today) return `Dziś ${weekday}, ${rest}`;
  return `${weekday}, ${rest}`;
}

function MacroLine({
  label,
  consumed,
  goal,
}: {
  label: string;
  consumed: number;
  goal: number | null;
}) {
  return (
    <p className="text-sm tabular-nums text-white/85">
      <span className="font-semibold text-white">{label}</span>{" "}
      {Math.round(consumed)}
      {goal != null ? ` / ${Math.round(goal)} g` : " g"}
    </p>
  );
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

export function MealSuggestionsView({
  initialSummary,
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
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [tab, setTab] = useState<"plan" | "dziennik">("dziennik");
  const [dateKey, setDateKey] = useState(initialGaps.dateKey);
  const [gaps, setGaps] = useState(initialGaps);
  const [logs, setLogs] = useState(initialLogs);
  const [dayKind, setDayKind] = useState<NutritionDayType>(initialDayKind);
  const [pending, start] = useTransition();
  const [scanOpen, setScanOpen] = useState(false);
  const [scanSlot, setScanSlot] = useState<DietDiarySlot | null>(null);
  const [addSheetSlot, setAddSheetSlot] = useState<DietDiarySlot | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<FoodProduct | null>(null);
  const [portionSlot, setPortionSlot] = useState<DietDiarySlot>("obiad");

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

  const kcalGoal = gaps.caloriesGoal;
  const kcalOver =
    kcalGoal != null ? Math.round(gaps.caloriesConsumed - kcalGoal) : null;
  const progressPct =
    kcalGoal != null && kcalGoal > 0
      ? Math.min(100, Math.round((gaps.caloriesConsumed / kcalGoal) * 100))
      : 0;
  const overGoal = kcalOver != null && kcalOver > 0;

  const bySlot = useMemo(() => {
    const map: Record<DietDiarySlot, MealLogDto[]> = {
      sniadanie: [],
      drugie_sniadanie: [],
      lunch: [],
      obiad: [],
      przekaska: [],
    };
    for (const e of logs) {
      if (e.slot && map[e.slot]) map[e.slot].push(e);
    }
    return map;
  }, [logs]);

  const unassigned = logs.filter((e) => e.slot == null);

  function openScan(slot?: DietDiarySlot) {
    setScanSlot(slot ?? dietDiarySlotFromHour(new Date().getHours()));
    setScanOpen(true);
  }

  const handleBarcode = useCallback(
    (code: string) => {
      setScanOpen(false);
      setScanBusy(true);
      const targetSlot = scanSlot ?? dietDiarySlotFromHour(new Date().getHours());
      start(async () => {
        try {
          const found = await lookupFoodByBarcodeAction(code);
          if (!found.ok) {
            notifyError(found.error);
            return;
          }
          setPortionSlot(targetSlot);
          setScannedProduct(found.product);
        } finally {
          setScanBusy(false);
        }
      });
    },
    [notifyError, scanSlot],
  );

  return (
    <div className="space-y-4 pb-8">
      <header className="px-0.5 pt-2">
        <p className="app-label">Co zjadłeś</p>
        <h1 className="mt-1 text-[34px] font-semibold leading-tight text-white">Dziennik</h1>
      </header>

      <div className="flex gap-2">
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
          Dziennik
        </button>
      </div>

      {tab === "plan" ? (
        <div className="space-y-4">
          {mealTemplates.length > 0 ? (
            <section className="app-card space-y-2 p-5">
              <p className="app-label">Szablony posiłków</p>
              {mealTemplates.map((m) => (
                <div key={m.id} className="flex justify-between gap-3 border-b border-white/[0.05] py-2.5 last:border-0">
                  <p className="text-sm text-white/85">{m.name}</p>
                  <p className="shrink-0 text-xs tabular-nums text-[var(--neon)]">
                    {Math.round(m.proteinG)}B · {Math.round(m.carbsG)}W · {Math.round(m.fatG)}T
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
          <div className="flex items-center justify-between gap-2 px-1">
            <button
              type="button"
              aria-label="Poprzedni dzień"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
              onClick={() => refreshDay(addCalendarDays(dateKey, -1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="text-center text-sm font-medium capitalize text-white/85">
              {formatPlLong(dateKey)}
            </p>
            <button
              type="button"
              aria-label="Następny dzień"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
              onClick={() => refreshDay(addCalendarDays(dateKey, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
                  ? "rounded-full border border-[var(--neon)]/45 bg-[var(--neon)]/20 px-4 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full border border-white/12 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-white/55"
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
                  ? "rounded-full border border-[var(--neon)]/45 bg-[var(--neon)]/20 px-4 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full border border-white/12 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-white/55"
              }
            >
              Nietreningowy
            </button>
            <span className="text-[11px] text-white/35">ustawione ręcznie</span>
          </div>

          <section className="rounded-2xl border border-[var(--neon)]/35 bg-[#0c0c0c] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[40px] font-semibold leading-none tabular-nums text-white">
                  {Math.round(gaps.caloriesConsumed)}{" "}
                  <span className="text-lg font-medium text-white/45">kcal</span>
                </p>
                <p className="mt-2 text-sm text-white/45">
                  {kcalGoal != null ? (
                    <>
                      z {Math.round(kcalGoal)} kcal
                      {kcalOver != null ? (
                        <span className={overGoal ? "text-rose-300" : "text-emerald-300"}>
                          {" "}
                          {kcalOver >= 0 ? `+${kcalOver}` : kcalOver}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "Ustaw cele w profilu"
                  )}
                </p>
              </div>
              <div className="space-y-1 text-right">
                <MacroLine label="B" consumed={gaps.proteinConsumed} goal={gaps.proteinGoal} />
                <MacroLine label="W" consumed={gaps.carbsConsumed} goal={gaps.carbsGoal} />
                <MacroLine label="T" consumed={gaps.fatConsumed} goal={gaps.fatGoal} />
              </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${overGoal ? "bg-rose-500" : "bg-[var(--neon)]"}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </section>

          <button
            type="button"
            disabled={scanBusy || pending}
            onClick={() => openScan()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#c9a227] to-[#e8c547] text-base font-semibold text-black shadow-[0_8px_24px_rgba(201,162,39,0.25)]"
          >
            {scanBusy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Odczytuję kod…
              </>
            ) : (
              <>
                <ScanBarcode className="h-5 w-5" />
                Skanuj kod kreskowy
              </>
            )}
          </button>

          <div className="space-y-4">
            {DIET_DIARY_SLOTS.map((slot) => {
              const items = bySlot[slot];
              const sumK = items.reduce((s, e) => s + e.calories, 0);
              const sumP = items.reduce((s, e) => s + e.proteinG, 0);
              const sumC = items.reduce((s, e) => s + e.carbsG, 0);
              const sumF = items.reduce((s, e) => s + e.fatG, 0);
              return (
                <section key={slot} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-heading text-lg font-semibold text-white">
                        {DIET_DIARY_SLOT_LABELS[slot]}
                      </h2>
                      <p className="text-xs tabular-nums text-white/45">
                        {Math.round(sumK)} kcal · B {Math.round(sumP)} W {Math.round(sumC)} T{" "}
                        {Math.round(sumF)}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Skanuj do ${DIET_DIARY_SLOT_LABELS[slot]}`}
                      onClick={() => openScan(slot)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--neon)]/40 text-[var(--neon)]"
                    >
                      <ScanBarcode className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Dodaj do ${DIET_DIARY_SLOT_LABELS[slot]}`}
                      onClick={() => setAddSheetSlot(slot)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--neon)]/40 text-[var(--neon)]"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-white/35">
                      Brak produktów — zeskanuj kod albo dodaj z bazy.
                    </p>
                  ) : (
                    <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/10 bg-white/[0.02]">
                      {items.map((e) => (
                        <li key={e.id} className="flex items-start gap-2 px-3 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">
                              {e.name?.trim() || "Posiłek"}
                            </p>
                            <p className="mt-0.5 text-xs tabular-nums text-white/45">
                              {Math.round(e.calories)} kcal · B{Math.round(e.proteinG)} W
                              {Math.round(e.carbsG)} T{Math.round(e.fatG)}
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
                  )}
                </section>
              );
            })}

            {unassigned.length > 0 ? (
              <section className="space-y-2 opacity-80">
                <h2 className="text-sm font-semibold text-white/70">Bez sekcji</h2>
                <ul className="divide-y divide-white/[0.06] rounded-2xl border border-dashed border-white/15">
                  {unassigned.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 px-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white/80">{e.name ?? "Posiłek"}</p>
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

      <BarcodeCameraScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={handleBarcode}
      />

      <FoodPortionSheet
        product={scannedProduct}
        open={Boolean(scannedProduct)}
        onOpenChange={(o) => {
          if (!o) setScannedProduct(null);
        }}
        slot={portionSlot}
        onSlotChange={setPortionSlot}
        pending={pending}
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
              `Zeskanowano „${product.name}” (${macros.label}) — ${Math.round(macros.proteinG)}B · ${Math.round(macros.carbsG)}W · ${Math.round(macros.fatG)}T · ${Math.round(macros.calories)} kcal`,
            );
            setScannedProduct(null);
            refreshDay(dateKey);
            router.refresh();
          });
        }}
      />

      {addSheetSlot ? (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/80 p-3 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="mx-auto max-w-lg">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/80"
                onClick={() => setAddSheetSlot(null)}
              >
                Zamknij
              </button>
            </div>
            <FoodSearchScan
              dateKey={dateKey}
              defaultSlot={addSheetSlot}
              lockedSlot={addSheetSlot}
              initialOpen
              onAdded={() => {
                setAddSheetSlot(null);
                refreshDay(dateKey);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
