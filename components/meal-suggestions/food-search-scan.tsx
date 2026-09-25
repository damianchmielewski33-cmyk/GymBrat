"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  lookupFoodByBarcodeAction,
  searchFoodProductsAction,
} from "@/actions/food-lookup";
import { addMealProductAction } from "@/actions/meal-log";
import type { FoodProduct } from "@/lib/food-products-types";
import type { DietDiarySlot } from "@/lib/diet-diary-slots";
import { DIET_DIARY_SLOT_LABELS, DIET_DIARY_SLOTS } from "@/lib/diet-diary-slots";
import { BarcodeCameraScanner } from "@/components/meal-suggestions/barcode-camera-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Camera, Loader2, ScanBarcode, Search } from "lucide-react";

function MacroPill({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wider text-white/45">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
        {Math.round(value * 10) / 10}
        <span className="ml-0.5 text-[10px] font-normal text-white/40">{unit}</span>
      </p>
    </div>
  );
}

export function FoodSearchScan({
  dateKey,
  defaultSlot,
  initialOpen = false,
  lockedSlot,
  onAdded,
}: {
  dateKey: string;
  defaultSlot: DietDiarySlot;
  initialOpen?: boolean;
  lockedSlot?: DietDiarySlot;
  onAdded?: () => void;
}) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<FoodProduct[]>([]);
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<FoodProduct | null>(null);
  const [slot, setSlot] = useState<DietDiarySlot>(lockedSlot ?? defaultSlot);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [lastScanInfo, setLastScanInfo] = useState<string | null>(null);

  useEffect(() => {
    if (lockedSlot) setSlot(lockedSlot);
  }, [lockedSlot]);

  useEffect(() => {
    if (initialOpen) {
      start(async () => {
        const r = await searchFoodProductsAction("");
        if (r.ok) setProducts(r.products);
      });
    }
  }, [initialOpen]);

  const runSearch = useCallback(
    (q: string) => {
      start(async () => {
        const r = await searchFoodProductsAction(q);
        if (!r.ok) {
          notifyError(r.error);
          return;
        }
        setProducts(r.products);
      });
    },
    [notifyError],
  );

  const addProduct = useCallback(
    async (product: FoodProduct, toSlot: DietDiarySlot, fromScan: boolean) => {
      const r = await addMealProductAction({
        date: dateKey,
        slot: toSlot,
        barcode: product.barcode,
        name: product.name,
        proteinG: product.proteinG,
        fatG: product.fatG,
        carbsG: product.carbsG,
        calories: product.calories,
      });
      if (!r.ok) {
        notifyError(r.error ?? "Nie udało się dodać produktu.");
        return false;
      }
      const macro = `${Math.round(product.proteinG)}B · ${Math.round(product.carbsG)}W · ${Math.round(product.fatG)}T · ${Math.round(product.calories)} kcal`;
      notifySaved(
        fromScan
          ? `Zeskanowano „${product.name}” — dodano makro (${macro}) do ${DIET_DIARY_SLOT_LABELS[toSlot]}.`
          : `Dodano „${product.name}” do ${DIET_DIARY_SLOT_LABELS[toSlot]}.`,
      );
      if (fromScan) {
        setLastScanInfo(`${product.name}: ${macro}`);
      }
      setSelected(null);
      onAdded?.();
      router.refresh();
      return true;
    },
    [dateKey, notifyError, notifySaved, onAdded, router],
  );

  const handleBarcodeDetected = useCallback(
    (code: string) => {
      setScanOpen(false);
      setScanBusy(true);
      start(async () => {
        try {
          const r = await lookupFoodByBarcodeAction(code);
          if (!r.ok) {
            notifyError(r.error);
            setQuery(code);
            runSearch(code);
            return;
          }
          setProducts([r.product]);
          // Po skanie etykiety — od razu dodaj makro do aktywnej sekcji.
          await addProduct(r.product, lockedSlot ?? slot, true);
        } finally {
          setScanBusy(false);
        }
      });
    },
    [addProduct, lockedSlot, notifyError, runSearch, slot],
  );

  return (
    <section className="app-card space-y-4 p-5">
      <div>
        <p className="app-label">Baza produktów</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Szukaj lub skanuj etykietę</h2>
        <p className="mt-1 text-sm text-white/55">
          Otwórz aparat, zeskanuj kod z opakowania — aplikacja odczyta produkt i doda jego białko,
          węglowodany, tłuszcz oraz kcal do dziennika.
        </p>
      </div>

      <Button
        type="button"
        variant="cta"
        className="h-12 w-full text-base"
        disabled={pending || scanBusy}
        onClick={() => setScanOpen(true)}
      >
        {scanBusy ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Odczytuję etykietę…
          </>
        ) : (
          <>
            <Camera className="mr-2 h-5 w-5" />
            Skanuj etykietę produktu
          </>
        )}
      </Button>

      {!lockedSlot ? (
        <div className="flex flex-wrap gap-2">
          {DIET_DIARY_SLOTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSlot(s)}
              className={
                slot === s
                  ? "rounded-full border border-[var(--neon)]/40 bg-[var(--neon)]/15 px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70"
              }
            >
              {DIET_DIARY_SLOT_LABELS[s]}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-white/55">
          Skan trafi do: <span className="text-white">{DIET_DIARY_SLOT_LABELS[slot]}</span>
        </p>
      )}

      {lastScanInfo ? (
        <p className="rounded-xl border border-[var(--neon)]/25 bg-[var(--neon)]/10 px-3 py-2 text-sm text-white/85">
          Ostatni skan: {lastScanInfo}
        </p>
      ) : null}

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch(query);
              }
            }}
            placeholder="Albo wpisz nazwę / kod EAN…"
            className="pl-9"
          />
        </div>
        <Button type="button" variant="outline" disabled={pending} onClick={() => runSearch(query)}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanBarcode className="h-4 w-4" />}
        </Button>
      </div>

      {products.length > 0 ? (
        <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/10">
          {products.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelected(p)}
                className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition hover:bg-white/[0.04]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{p.name}</p>
                  <p className="mt-0.5 text-xs text-white/45">
                    {[p.brand, p.servingLabel, p.barcode ? `EAN ${p.barcode}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p className="shrink-0 text-xs tabular-nums text-[var(--neon)]">
                  {Math.round(p.proteinG)}B · {Math.round(p.carbsG)}W · {Math.round(p.fatG)}T
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-white/40">
          Użyj aparatu albo wyszukiwania, żeby znaleźć produkt i zobaczyć makro.
        </p>
      )}

      <BarcodeCameraScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={handleBarcodeDetected}
      />

      <Sheet open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="bottom" className="border-white/10 bg-[#07070c] text-white">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-white">{selected.name}</SheetTitle>
                <SheetDescription className="text-white/55">
                  {[selected.brand, selected.servingLabel].filter(Boolean).join(" · ")}
                  {selected.source === "openfoodfacts" ? " · Open Food Facts" : " · baza GymBrat"}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6">
                <div className="grid grid-cols-4 gap-2">
                  <MacroPill label="Kcal" value={selected.calories} unit="" />
                  <MacroPill label="Białko" value={selected.proteinG} unit="g" />
                  <MacroPill label="Węgle" value={selected.carbsG} unit="g" />
                  <MacroPill label="Tłuszcz" value={selected.fatG} unit="g" />
                </div>

                {!lockedSlot ? (
                  <div className="flex flex-wrap gap-2">
                    {DIET_DIARY_SLOTS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSlot(s)}
                        className={
                          slot === s
                            ? "rounded-full border border-[var(--neon)]/40 bg-[var(--neon)]/15 px-3 py-1.5 text-xs font-semibold text-white"
                            : "rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70"
                        }
                      >
                        {DIET_DIARY_SLOT_LABELS[s]}
                      </button>
                    ))}
                  </div>
                ) : null}

                <SheetFooter className="flex flex-row gap-2 px-0">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSelected(null)}
                  >
                    Anuluj
                  </Button>
                  <Button
                    type="button"
                    variant="cta"
                    className="flex-[1.2]"
                    disabled={pending}
                    onClick={() => {
                      start(async () => {
                        await addProduct(selected, slot, false);
                      });
                    }}
                  >
                    Dodaj makro
                  </Button>
                </SheetFooter>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}
