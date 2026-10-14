"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { ScanBarcode, X } from "lucide-react";
import { lookupFoodByBarcodeAction } from "@/actions/food-lookup";
import { addMealProductAction } from "@/actions/meal-log";
import { FoodPortionScreen } from "@/components/meal-suggestions/food-portion-screen";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  dietDiarySlotFromHour,
  type DietDiarySlot,
} from "@/lib/diet-diary-slots";
import type { FoodProduct } from "@/lib/food-products-types";
import { calendarDateKey } from "@/lib/local-date";

const BarcodeCameraScanner = dynamic(
  () =>
    import("@/components/meal-suggestions/barcode-camera-scanner").then(
      (m) => m.BarcodeCameraScanner,
    ),
  { ssr: false },
);

const EMPTY_DAY_MACROS = {
  caloriesConsumed: 0,
  caloriesGoal: null as number | null,
  proteinConsumed: 0,
  proteinGoal: null as number | null,
  fatConsumed: 0,
  fatGoal: null as number | null,
  carbsConsumed: 0,
  carbsGoal: null as number | null,
};

/**
 * Skan z Pulpitu — od razu pełny ekran aparatu, bez czekania na RSC Diety.
 */
export function HomeScanButton() {
  const router = useRouter();
  const { notifyError, notifySaved } = useSaveFeedback();
  const [pending, start] = useTransition();
  const [scanOpen, setScanOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [portionProduct, setPortionProduct] = useState<FoodProduct | null>(
    null,
  );
  const [portionSlot, setPortionSlot] = useState<DietDiarySlot>("sniadanie");

  // Prefetch chunk skanera w tle — pierwszy tap bez czekania na zxing.
  useEffect(() => {
    void import("@/components/meal-suggestions/barcode-camera-scanner");
  }, []);

  const openScan = useCallback(() => {
    setPortionSlot(dietDiarySlotFromHour(new Date().getHours()));
    setScanOpen(true);
  }, []);

  const onDetected = useCallback(
    (code: string) => {
      setScanOpen(false);
      setScanBusy(true);
      start(async () => {
        try {
          const r = await lookupFoodByBarcodeAction(code);
          if (!r.ok) {
            notifyError(r.error);
            router.push("/meal-suggestions?tab=diary&add=1");
            return;
          }
          setPortionProduct(r.product);
        } finally {
          setScanBusy(false);
        }
      });
    },
    [notifyError, router],
  );

  return (
    <>
      <button
        type="button"
        aria-label="Skanuj produkt i dodaj posiłek"
        className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-[var(--gym-gold)]/70 bg-[var(--gym-gold)]/10 text-[var(--gym-gold)] transition-colors hover:border-[var(--gym-gold)] hover:bg-[var(--gym-gold)]/15"
        onClick={openScan}
      >
        <ScanBarcode className="h-5 w-5" aria-hidden />
      </button>

      {/* Natychmiastowy ekran z X — zanim doładuje się chunk skanera (zxing). */}
      {scanOpen ? (
        <div className="fixed inset-0 z-[199] bg-black text-white">
          <div className="absolute inset-x-0 top-0 z-[1] flex items-center justify-between px-4 pt-[max(0.85rem,env(safe-area-inset-top))]">
            <button
              type="button"
              aria-label="Zamknij skaner"
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white"
              onClick={() => setScanOpen(false)}
            >
              <X className="h-5 w-5" strokeWidth={2.25} />
            </button>
          </div>
          <p className="absolute inset-x-4 bottom-[max(2rem,env(safe-area-inset-bottom))] text-center text-sm text-white/55">
            Uruchamiam aparat…
          </p>
        </div>
      ) : null}

      <BarcodeCameraScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={onDetected}
      />

      {scanBusy ? (
        <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/80 text-sm text-white/80">
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
        dayMacros={EMPTY_DAY_MACROS}
        onConfirm={({ product, macros }) => {
          start(async () => {
            const added = await addMealProductAction({
              date: calendarDateKey(),
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
              `Dodano „${product.name}” (${macros.label}) do dziennika.`,
            );
            setPortionProduct(null);
            router.push("/meal-suggestions?tab=diary");
            router.refresh();
          });
        }}
      />
    </>
  );
}
