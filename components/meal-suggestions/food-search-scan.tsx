"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
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
import { FoodPortionSheet } from "@/components/meal-suggestions/food-portion-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Camera, Loader2, ScanBarcode, Search } from "lucide-react";
import type { FoodPortionMacros } from "@/lib/food-portion";

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
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchGen = useRef(0);

  useEffect(() => {
    if (lockedSlot) setSlot(lockedSlot);
  }, [lockedSlot]);

  const runSearch = useCallback(
    (q: string) => {
      const gen = ++searchGen.current;
      start(async () => {
        const r = await searchFoodProductsAction(q);
        if (gen !== searchGen.current) return;
        if (!r.ok) {
          notifyError(r.error);
          return;
        }
        setProducts(r.products);
        setSearchHint(
          r.products.length === 0
            ? q.trim()
              ? `Brak wyników dla „${q.trim()}”. Spróbuj innej nazwy albo skanu EAN.`
              : null
            : null,
        );
      });
    },
    [notifyError],
  );

  useEffect(() => {
    if (initialOpen) runSearch("");
  }, [initialOpen, runSearch]);

  // Wyszukiwanie na żywo przy wpisywaniu (debounce).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setSearchHint(null);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(q), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const confirmAdd = useCallback(
    async (
      product: FoodProduct,
      toSlot: DietDiarySlot,
      macros: FoodPortionMacros,
      fromScan: boolean,
    ) => {
      const nameWithAmount = `${product.name} (${macros.label})`;
      const r = await addMealProductAction({
        date: dateKey,
        slot: toSlot,
        barcode: product.barcode,
        name: nameWithAmount,
        proteinG: macros.proteinG,
        fatG: macros.fatG,
        carbsG: macros.carbsG,
        calories: macros.calories,
      });
      if (!r.ok) {
        notifyError(r.error ?? "Nie udało się dodać produktu.");
        return false;
      }
      const macro = `${Math.round(macros.proteinG)}B · ${Math.round(macros.carbsG)}W · ${Math.round(macros.fatG)}T · ${Math.round(macros.calories)} kcal`;
      notifySaved(
        fromScan
          ? `Zeskanowano „${product.name}” (${macros.label}) — ${macro} → ${DIET_DIARY_SLOT_LABELS[toSlot]}.`
          : `Dodano „${product.name}” (${macros.label}) do ${DIET_DIARY_SLOT_LABELS[toSlot]}.`,
      );
      if (fromScan) setLastScanInfo(`${product.name} (${macros.label}): ${macro}`);
      setSelected(null);
      onAdded?.();
      router.refresh();
      return true;
    },
    [dateKey, notifyError, notifySaved, onAdded, router],
  );

  const fromScanRef = useRef(false);

  const handleBarcodeDetected = useCallback(
    (code: string) => {
      setScanOpen(false);
      setScanBusy(true);
      fromScanRef.current = true;
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
          setSelected(r.product);
        } finally {
          setScanBusy(false);
        }
      });
    },
    [notifyError, runSearch],
  );

  return (
    <section className="app-card space-y-4 p-5">
      <div>
        <p className="app-label">Baza produktów</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Szukaj lub skanuj etykietę</h2>
        <p className="mt-1 text-sm text-white/55">
          Wpisz nazwę (np. kiwi) albo zeskanuj EAN — potem ustaw gramy, ml albo sztuki i dodaj makro.
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
            placeholder="Wpisz np. kiwi, jogurt, banan…"
            className="pl-9"
            autoComplete="off"
            autoCorrect="off"
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
                onClick={() => {
                  fromScanRef.current = false;
                  setSelected(p);
                }}
                className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition hover:bg-white/[0.04]"
              >
                <div className="min-w-0">
                  <p
                    className="notranslate truncate text-sm font-medium text-white"
                    translate="no"
                  >
                    {p.name}
                  </p>
                  <p className="mt-0.5 text-xs text-white/45">
                    {[p.brand, p.servingLabel, p.barcode ? `EAN ${p.barcode}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p className="shrink-0 text-xs tabular-nums text-[var(--neon)]">
                  {Math.round(p.proteinG)}B · {Math.round(p.carbsG)}W · {Math.round(p.fatG)}T
                  <span className="block text-[10px] text-white/35">
                    / {p.servingLabel || "porcja"}
                  </span>
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-white/40">
          {searchHint ?? "Wpisz nazwę produktu albo użyj aparatu — wyniki pojawią się poniżej."}
        </p>
      )}

      <BarcodeCameraScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={handleBarcodeDetected}
      />

      <FoodPortionSheet
        product={selected}
        open={Boolean(selected)}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
        slot={slot}
        onSlotChange={setSlot}
        lockedSlot={lockedSlot}
        pending={pending}
        onConfirm={({ product, macros }) => {
          start(async () => {
            await confirmAdd(product, slot, macros, fromScanRef.current);
          });
        }}
      />
    </section>
  );
}
