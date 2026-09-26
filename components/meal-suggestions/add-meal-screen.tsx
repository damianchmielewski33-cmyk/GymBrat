"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Loader2, ScanBarcode, Search } from "lucide-react";
import {
  lookupFoodByBarcodeAction,
  searchFoodProductsAction,
} from "@/actions/food-lookup";
import { BarcodeCameraScanner } from "@/components/meal-suggestions/barcode-camera-scanner";
import {
  DIET_DIARY_SLOT_LABELS,
  type DietDiarySlot,
} from "@/lib/diet-diary-slots";
import type { FoodProduct } from "@/lib/food-products-types";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { cn } from "@/lib/utils";

/**
 * Pełny ekran dodawania jak Fitatu: Szukaj + skan w pasku.
 */
export function AddMealScreen({
  open,
  slot,
  dateLabel,
  onClose,
  onPickProduct,
}: {
  open: boolean;
  slot: DietDiarySlot;
  dateLabel: string;
  onClose: () => void;
  onPickProduct: (product: FoodProduct, fromScan: boolean) => void;
}) {
  const { notifyError } = useSaveFeedback();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<FoodProduct[]>([]);
  const [pending, start] = useTransition();
  const [scanOpen, setScanOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const genRef = useRef(0);

  useEffect(() => setMounted(true), []);

  const runSearch = useCallback(
    (q: string) => {
      const gen = ++genRef.current;
      start(async () => {
        const r = await searchFoodProductsAction(q);
        if (gen !== genRef.current) return;
        if (!r.ok) {
          notifyError(r.error);
          return;
        }
        setProducts(r.products);
        setHint(
          r.products.length === 0 && q.trim()
            ? `Brak wyników dla „${q.trim()}”.`
            : null,
        );
      });
    },
    [notifyError],
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    runSearch("");
  }, [open, runSearch]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) return;
    debounceRef.current = setTimeout(() => runSearch(q), 260);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, runSearch]);

  const onBarcode = useCallback(
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
          onPickProduct(r.product, true);
        } finally {
          setScanBusy(false);
        }
      });
    },
    [notifyError, onPickProduct, runSearch],
  );

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[170] flex flex-col bg-[#0c0c0c] text-white">
      <header className="border-b border-white/10 bg-[#141414] px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Wróć"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/85"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-base font-semibold">{DIET_DIARY_SLOT_LABELS[slot]}</p>
            <p className="text-xs text-white/45">{dateLabel}</p>
          </div>
          <span className="w-10" />
        </div>

        <div className="mt-3 flex gap-4 px-1 text-sm">
          <span className="border-b-2 border-[var(--gym-gold)] pb-1 font-semibold text-white">
            Szukaj
          </span>
          <span className="pb-1 text-white/35">Własne</span>
          <span className="pb-1 text-white/35">Ulubione</span>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Wpisz nazwę produktu…"
            autoFocus
            autoComplete="off"
            className="h-12 w-full rounded-xl border border-white/12 bg-black/50 py-2 pl-10 pr-12 text-base text-white outline-none placeholder:text-white/35"
          />
          <button
            type="button"
            aria-label="Skanuj kod kreskowy"
            disabled={scanBusy}
            onClick={() => setScanOpen(true)}
            className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--gym-gold)]"
          >
            {scanBusy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ScanBarcode className="h-5 w-5" />
            )}
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="px-4 pb-2 pt-4 text-xs font-medium uppercase tracking-wider text-white/40">
          {query.trim() ? "Wyniki" : "Popularne / ostatnie"}
        </p>
        {pending && products.length === 0 ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
        ) : products.length === 0 ? (
          <p className="px-4 py-8 text-sm text-white/40">
            {hint ?? "Wpisz nazwę albo zeskanuj kod EAN."}
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {products.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPickProduct(p, false)}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.04]",
                  )}
                >
                  <div className="min-w-0">
                    <p
                      className="notranslate truncate text-sm font-medium text-white"
                      translate="no"
                    >
                      {p.name}
                    </p>
                    <p className="mt-0.5 text-xs text-white/40">
                      {[p.brand, p.servingLabel].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-xs tabular-nums text-white/55">
                    {Math.round(p.calories)} kcal
                    <span className="mt-0.5 block text-[10px] text-white/35">
                      / {p.servingLabel || "porcja"}
                    </span>
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BarcodeCameraScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={onBarcode}
      />
    </div>,
    document.body,
  );
}
