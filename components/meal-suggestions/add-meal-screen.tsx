"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  ChevronLeft,
  Loader2,
  Plus,
  ScanBarcode,
  Search,
  UtensilsCrossed,
} from "lucide-react";
import {
  lookupFoodByBarcodeAction,
  listRecentFoodProductsAction,
  searchFoodProductsAction,
} from "@/actions/food-lookup";
import { addMealLogAction, type MealLogFormState } from "@/actions/meal-log";
import { BarcodeCameraScanner } from "@/components/meal-suggestions/barcode-camera-scanner";
import {
  DIET_DIARY_SLOT_LABELS,
  type DietDiarySlot,
} from "@/lib/diet-diary-slots";
import { MEAL_PLAN_DIARY_SLOTS } from "@/lib/diet-recipe-match";
import type { FoodProduct } from "@/lib/food-products-types";
import { getFoodMacroSourceLabel } from "@/lib/food-macro-source";
import { searchLocalProducts } from "@/lib/food-products";
import {
  favoriteToFoodProduct,
  listFavoriteFoods,
} from "@/lib/food-favorites";
import { kcalFromMacros, parseMacroGrams } from "@/lib/kcal-from-macros";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { cn } from "@/lib/utils";

type SubScreen = "search" | "product" | "quick";
type ListTab = "search" | "recents" | "favorites";

/**
 * Pełny ekran dodawania — układ jak makieta: skan / dania / wyszukiwanie.
 */
export function AddMealScreen({
  open,
  slot,
  dateKey,
  dateLabel,
  slotCaloriesGoal = null,
  onClose,
  onPickProduct,
  onOpenDish,
  onSaved,
}: {
  open: boolean;
  slot: DietDiarySlot;
  dateKey: string;
  dateLabel: string;
  /** Cel kcal z szablonu Posiłek N (nagłówek makiety). */
  slotCaloriesGoal?: number | null;
  onClose: () => void;
  onPickProduct: (product: FoodProduct, fromScan: boolean) => void;
  onOpenDish: () => void;
  onSaved: () => void;
}) {
  const { notifyError, notifySaved } = useSaveFeedback();
  const [mounted, setMounted] = useState(false);
  const [sub, setSub] = useState<SubScreen>("search");
  const [listTab, setListTab] = useState<ListTab>("search");
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<FoodProduct[]>([]);
  const [fromRecents, setFromRecents] = useState(false);
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
  const handledStateRef = useRef<MealLogFormState | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setSub("search");
      setListTab("search");
      setName("");
      setProtein("");
      setFat("");
      setCarbs("");
      setKcal("");
      setQuery("");
      setFromRecents(false);
    }
  }, [open]);

  useEffect(() => {
    if (!state || state === handledStateRef.current) return;
    if (state.ok) {
      handledStateRef.current = state;
      notifySaved(
        sub === "product" ? "Produkt dodany do dziennika." : "Zapisano szybkie dodawanie.",
      );
      onSaved();
      onClose();
    } else if (state.error) {
      handledStateRef.current = state;
      notifyError(state.error);
    }
  }, [state, sub, notifySaved, notifyError, onSaved, onClose]);

  const loadRecents = useCallback(() => {
    const gen = ++genRef.current;
    start(async () => {
      const r = await listRecentFoodProductsAction(24);
      if (gen !== genRef.current) return;
      if (!r.ok) {
        notifyError(r.error);
        return;
      }
      setProducts(r.products);
      setFromRecents(Boolean(r.fromRecents));
      setHint(
        r.products.length === 0
          ? "Brak historii — dodaj pierwszy produkt z wyszukiwania."
          : null,
      );
    });
  }, [notifyError]);

  const loadFavorites = useCallback(() => {
    const favs = listFavoriteFoods().map(favoriteToFoodProduct);
    setProducts(favs);
    setFromRecents(false);
    setHint(
      favs.length === 0
        ? "Brak ulubionych — dodaj sercem na ekranie porcji."
        : null,
    );
  }, []);

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
        setFromRecents(Boolean(r.fromRecents) && !q.trim());
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
    if (listTab === "favorites") {
      loadFavorites();
      return;
    }
    if (listTab === "recents") {
      setQuery("");
      loadRecents();
      return;
    }
    // Pusty stan jak na makiecie — bez automatycznych propozycji.
    setQuery("");
    setProducts([]);
    setFromRecents(false);
    setHint(null);
  }, [open, sub, listTab, loadFavorites, loadRecents]);

  useEffect(() => {
    if (!open || sub !== "search" || listTab !== "search") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setProducts([]);
      setFromRecents(false);
      setHint(null);
      return;
    }
    // Natychmiast lokalne podpowiedzi jak w Fitatu (ban→Banan), potem pełne API.
    setFromRecents(false);
    setProducts(searchLocalProducts(q, 24));
    setHint(null);
    debounceRef.current = setTimeout(() => runSearch(q), 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, sub, listTab, runSearch]);

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
            <p className="text-xs text-white/45">
              {DIET_DIARY_SLOT_LABELS[slot]} · {dateLabel}
            </p>
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

  const mealIndex = Math.max(1, MEAL_PLAN_DIARY_SLOTS.indexOf(slot) + 1);
  const goalLabel =
    slotCaloriesGoal != null && Number.isFinite(slotCaloriesGoal)
      ? `CEL ${Math.round(slotCaloriesGoal)} KCAL`
      : DIET_DIARY_SLOT_LABELS[slot].toUpperCase();
  const kicker = `POSIŁEK ${mealIndex} · ${goalLabel}`;
  const emptySearch =
    listTab === "search" && !query.trim() && products.length === 0 && !pending;
  const showBrowseChrome = !emptySearch;

  return createPortal(
    <div className="fixed inset-0 z-[170] flex flex-col bg-black text-white">
      <header className="relative overflow-hidden px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-[var(--gym-gold)]/[0.07] blur-3xl"
        />
        <button
          type="button"
          onClick={onClose}
          className="relative inline-flex items-center gap-1.5 text-[15px] text-white/85"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
          Wróć
        </button>
        <p className="relative mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
          {kicker}
        </p>
        <h1 className="relative mt-1.5 text-[28px] font-semibold leading-tight tracking-tight text-white">
          Dodaj do dziennika
        </h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={scanBusy}
            onClick={() => setScanOpen(true)}
            className="gold-btn inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl px-3 text-[14px] font-semibold text-black disabled:opacity-55"
          >
            {scanBusy ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <ScanBarcode className="h-5 w-5" aria-hidden />
            )}
            Skanuj kod
          </button>
          <button
            type="button"
            onClick={onOpenDish}
            className="inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/18 bg-transparent px-3 text-[14px] font-semibold text-white transition hover:bg-white/[0.04]"
          >
            <UtensilsCrossed
              className="h-5 w-5 text-[var(--gym-gold)]"
              aria-hidden
            />
            Dania z diety
          </button>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Search className="h-[18px] w-[18px] shrink-0 text-white" aria-hidden />
          <input
            value={query}
            onChange={(e) => {
              setListTab("search");
              setQuery(e.target.value);
            }}
            placeholder="albo wpisz nazwę: serek, ryż, jabłko…"
            autoFocus
            autoComplete="off"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-[#1a1a1a] px-3.5 text-[14px] text-white outline-none placeholder:text-white/35 focus:border-[var(--gym-gold)]/35"
          />
        </div>

        <button
          type="button"
          disabled={scanBusy}
          onClick={() => setScanOpen(true)}
          className="mt-3.5 inline-flex h-11 items-center gap-2 rounded-2xl border border-white/14 bg-transparent px-3.5 text-[13px] font-semibold text-white/90 transition hover:bg-white/[0.04] disabled:opacity-55"
        >
          <Camera className="h-4 w-4 text-white/75" aria-hidden />
          Ze zdjęcia etykiety
        </button>

        {emptySearch ? (
          <div className="mt-6">
            <p className="text-[15px] leading-snug text-white/85">
              Wpisz nazwę produktu albo zeskanuj kod.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
              <button
                type="button"
                onClick={() => setListTab("recents")}
                className="font-semibold text-white/55 transition hover:text-white"
              >
                Ostatnie
              </button>
              <button
                type="button"
                onClick={() => setListTab("favorites")}
                className="font-semibold text-white/55 transition hover:text-white"
              >
                Ulubione
              </button>
              <button
                type="button"
                onClick={() => setSub("product")}
                className="font-semibold text-white/55 transition hover:text-white"
              >
                Nowy produkt
              </button>
              <button
                type="button"
                onClick={() => setSub("quick")}
                className="font-semibold text-white/55 transition hover:text-white"
              >
                Szybkie dodawanie
              </button>
            </div>
          </div>
        ) : null}

        {showBrowseChrome ? (
          <>
            <div className="mt-5 flex gap-2">
              {(
                [
                  { id: "search" as const, label: "Szukaj" },
                  { id: "recents" as const, label: "Ostatnie" },
                  { id: "favorites" as const, label: "Ulubione" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setListTab(tab.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[12px] font-semibold transition",
                    listTab === tab.id
                      ? "border border-[var(--gym-gold)]/60 bg-[var(--gym-gold)]/10 text-[var(--gym-gold)]"
                      : "border border-transparent bg-white/[0.04] text-white/45",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
              {listTab === "favorites"
                ? "Ulubione"
                : listTab === "recents" || (fromRecents && !query.trim())
                  ? "Ostatnio jedzone"
                  : query.trim()
                    ? "Wyniki"
                    : "Propozycje"}
            </p>

            <div className="mt-2">
              {pending && products.length === 0 ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-white/40" />
                </div>
              ) : products.length === 0 ? (
                <p className="py-6 text-[13px] text-white/40">
                  {hint ??
                    (listTab === "recents"
                      ? "Powtórz produkty z historii dziennika."
                      : listTab === "favorites"
                        ? "Dodaj ulubione sercem na ekranie porcji."
                        : "Brak wyników — spróbuj innej nazwy.")}
                </p>
              ) : (
                <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.07] bg-[#121214]">
                  {products.map((prod) => (
                    <li key={prod.id}>
                      <button
                        type="button"
                        onClick={() => onPickProduct(prod, false)}
                        className="flex w-full items-start justify-between gap-3 px-3.5 py-3 text-left transition hover:bg-white/[0.03]"
                      >
                        <div className="min-w-0">
                          <p
                            className="notranslate truncate text-[14px] font-semibold text-white"
                            translate="no"
                          >
                            {prod.name}
                          </p>
                          <p className="mt-0.5 text-[12px] text-white/40">
                            {[
                              prod.brand,
                              prod.servingLabel,
                              getFoodMacroSourceLabel(prod),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <p className="shrink-0 text-right text-[12px] tabular-nums text-white/55">
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

            <div className="mt-6 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSub("product")}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-[#141414] px-2 py-3 text-center"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]">
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </span>
                <span className="text-[11px] font-semibold leading-tight text-white/80">
                  Nowy produkt
                </span>
              </button>
              <button
                type="button"
                onClick={onOpenDish}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-[#141414] px-2 py-3 text-center"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]">
                  <UtensilsCrossed className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-semibold leading-tight text-white/80">
                  Nowa potrawa
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSub("quick")}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-[#141414] px-2 py-3 text-center"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]">
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </span>
                <span className="text-[11px] font-semibold leading-tight text-white/80">
                  Szybkie dodawanie
                </span>
              </button>
            </div>
          </>
        ) : null}
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
