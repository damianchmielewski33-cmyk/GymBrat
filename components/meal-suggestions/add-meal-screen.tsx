"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  Loader2,
  Plus,
  ScanBarcode,
  Search,
} from "lucide-react";
import {
  lookupFoodByBarcodeAction,
  searchFoodProductsAction,
} from "@/actions/food-lookup";
import { addMealLogAction, type MealLogFormState } from "@/actions/meal-log";
import { BarcodeCameraScanner } from "@/components/meal-suggestions/barcode-camera-scanner";
import {
  DIET_DIARY_SLOT_LABELS,
  type DietDiarySlot,
} from "@/lib/diet-diary-slots";
import type { FoodProduct } from "@/lib/food-products-types";
import { kcalFromMacros, parseMacroGrams } from "@/lib/kcal-from-macros";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { cn } from "@/lib/utils";

type SubScreen = "search" | "product" | "quick";

/**
 * Pełny ekran dodawania jak Fitatu: Szukaj + 3 przyciski na dole.
 */
export function AddMealScreen({
  open,
  slot,
  dateKey,
  dateLabel,
  onClose,
  onPickProduct,
  onOpenDish,
  onSaved,
}: {
  open: boolean;
  slot: DietDiarySlot;
  dateKey: string;
  dateLabel: string;
  onClose: () => void;
  onPickProduct: (product: FoodProduct, fromScan: boolean) => void;
  onOpenDish: () => void;
  onSaved: () => void;
}) {
  const { notifyError, notifySaved } = useSaveFeedback();
  const [mounted, setMounted] = useState(false);
  const [sub, setSub] = useState<SubScreen>("search");
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<FoodProduct[]>([]);
  const [pending, start] = useTransition();
  const [scanOpen, setScanOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const genRef = useRef(0);

  const [name, setName] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [kcal, setKcal] = useState("");

  const [state, formAction, savePending] = useActionState(
    addMealLogAction,
    {} as MealLogFormState,
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setSub("search");
      setName("");
      setProtein("");
      setFat("");
      setCarbs("");
      setKcal("");
      setQuery("");
    }
  }, [open]);

  useEffect(() => {
    if (state?.ok) {
      notifySaved(
        sub === "product" ? "Produkt dodany do dziennika." : "Zapisano szybkie dodawanie.",
      );
      onSaved();
      onClose();
    } else if (state?.error) {
      notifyError(state.error);
    }
  }, [state, sub, notifySaved, notifyError, onSaved, onClose]);

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
    if (!open || sub !== "search") return;
    setQuery("");
    runSearch("");
  }, [open, sub, runSearch]);

  useEffect(() => {
    if (!open || sub !== "search") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) return;
    debounceRef.current = setTimeout(() => runSearch(q), 260);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, sub, runSearch]);

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

  const p = parseMacroGrams(protein);
  const f = parseMacroGrams(fat);
  const c = parseMacroGrams(carbs);
  const hasMacros = p > 0 || f > 0 || c > 0;
  const computedKcal = hasMacros ? kcalFromMacros(p, f, c) : null;
  const manualKcal = parseMacroGrams(kcal);
  const finalKcal = manualKcal > 0 ? Math.round(manualKcal) : computedKcal;

  if (sub === "product" || sub === "quick") {
    const title = sub === "product" ? "Nowy produkt" : "Szybkie dodawanie";
    return createPortal(
      <div className="fixed inset-0 z-[180] flex flex-col bg-[#0c0c0c] text-white">
        <header className="flex items-center gap-2 border-b border-white/10 bg-[#141414] px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            aria-label="Wróć"
            onClick={() => setSub("search")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/85"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-base font-semibold">{title}</p>
            <p className="text-xs text-white/45">{DIET_DIARY_SLOT_LABELS[slot]}</p>
          </div>
          <button
            type="submit"
            form="quick-meal-form"
            disabled={savePending}
            className="min-w-10 text-sm font-semibold text-[var(--gym-gold)] disabled:opacity-45"
          >
            Zapisz
          </button>
        </header>

        <form
          id="quick-meal-form"
          action={formAction}
          className="flex min-h-0 flex-1 flex-col"
        >
          <input type="hidden" name="date" value={dateKey} />
          <input type="hidden" name="slot" value={slot} />
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
            <label className="block">
              <span className="text-sm text-white/80">Nazwa</span>
              <input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={sub === "product"}
                placeholder={
                  sub === "product" ? "np. Skyr naturalny" : "np. Kanapka z pracy"
                }
                className="mt-2 h-12 w-full rounded-xl border-0 bg-[var(--gym-gold)]/90 px-3 text-base font-medium text-black outline-none placeholder:text-black/45"
              />
            </label>

            {(
              [
                ["calories", "Wartość energetyczna", "kcal", kcal, setKcal],
                ["fatG", "Tłuszcze", "g", fat, setFat],
                ["carbsG", "Węglowodany", "g", carbs, setCarbs],
                ["proteinG", "Białka", "g", protein, setProtein],
              ] as const
            ).map(([field, label, unit, val, setVal]) => (
              <div
                key={field}
                className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-3"
              >
                <span className="text-sm text-white/85">{label}</span>
                <div className="flex items-center gap-2">
                  <input
                    name={field}
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    inputMode="decimal"
                    className="h-10 w-20 rounded-lg border-0 bg-[var(--gym-gold)]/90 px-2 text-center text-base font-semibold tabular-nums text-black outline-none"
                  />
                  <span className="w-8 text-sm text-white/55">{unit}</span>
                </div>
              </div>
            ))}

            {finalKcal != null && !kcal.trim() ? (
              <p className="text-xs text-white/40">
                Z makro ≈ {finalKcal} kcal
              </p>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-white/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <button
              type="submit"
              disabled={savePending}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-white text-base font-semibold text-black disabled:opacity-55"
            >
              {savePending ? "Zapisuję…" : "Zapisz"}
            </button>
          </div>
        </form>
      </div>,
      document.body,
    );
  }

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

      <div className="min-h-0 flex-1 overflow-y-auto pb-28">
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
            {products.map((prod) => (
              <li key={prod.id}>
                <button
                  type="button"
                  onClick={() => onPickProduct(prod, false)}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.04]",
                  )}
                >
                  <div className="min-w-0">
                    <p
                      className="notranslate truncate text-sm font-medium text-white"
                      translate="no"
                    >
                      {prod.name}
                    </p>
                    <p className="mt-0.5 text-xs text-white/40">
                      {[prod.brand, prod.servingLabel].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-xs tabular-nums text-white/55">
                    {Math.round(prod.calories)} kcal
                    <span className="mt-0.5 block text-[10px] text-white/35">
                      / {prod.servingLabel || "porcja"}
                    </span>
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Fitatu-like: 3 przyciski na dole */}
      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-white/10 bg-[#121212] px-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2">
        <div className="mx-auto grid max-w-lg grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => setSub("product")}
            className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center active:bg-white/[0.06]"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--gym-gold)] text-black">
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-white">
              Nowy produkt
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenDish}
            className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center active:bg-white/[0.06]"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--gym-gold)] text-black">
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-white">
              Nowa potrawa
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSub("quick")}
            className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center active:bg-white/[0.06]"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--gym-gold)] text-black">
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-white">
              Szybkie dodawanie
            </span>
          </button>
        </div>
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
