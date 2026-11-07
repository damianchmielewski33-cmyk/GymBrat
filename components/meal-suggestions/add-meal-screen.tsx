"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  ChevronLeft,
  Clock,
  Heart,
  Loader2,
  Plus,
  ScanBarcode,
  Search,
  UtensilsCrossed,
  Zap,
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
            <p className="text-xs text-white/50">
              {DIET_DIARY_SLOT_LABELS[slot]} · {dateLabel}
            </p>
          </div>
          <span aria-hidden className="w-10" />
        </header>

        <form
          id="quick-meal-form"
          action={formAction}
          className="flex min-h-0 flex-1 flex-col"
        >
          <input type="hidden" name="date" value={dateKey} />
          <input type="hidden" name="slot" value={slot} />
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                Nazwa
              </span>
              <input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={sub === "product"}
                autoComplete="off"
                placeholder={
                  sub === "product" ? "np. Skyr naturalny" : "np. Kanapka z pracy"
                }
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-[#1a1a1a] px-3.5 text-[15px] font-medium text-white outline-none placeholder:text-white/50 focus:border-[var(--gym-gold)]/45"
              />
            </label>

            <label className="block rounded-3xl border border-white/10 bg-[#121214] px-4 py-5 text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                Wartość energetyczna
              </span>
              <span className="mt-2 flex items-baseline justify-center gap-2">
                <input
                  name="calories"
                  value={kcal}
                  onChange={(e) => setKcal(e.target.value)}
                  inputMode="decimal"
                  placeholder={computedKcal != null ? String(computedKcal) : "0"}
                  className="w-32 border-0 bg-transparent text-center text-5xl font-semibold tabular-nums text-[var(--gym-gold)] outline-none placeholder:text-white/50"
                />
                <span className="text-base text-white/50">kcal</span>
              </span>
              <span className="mt-1 block text-xs text-white/50">
                {computedKcal != null && !kcal.trim()
                  ? "Policzone z makroskładników"
                  : "Zostaw puste, by policzyć z makro"}
              </span>
            </label>

            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  ["proteinG", "Białka", "bg-sky-400", protein, setProtein],
                  ["carbsG", "Węglowodany", "bg-amber-400", carbs, setCarbs],
                  ["fatG", "Tłuszcze", "bg-rose-400", fat, setFat],
                ] as const
              ).map(([field, label, dot, val, setVal]) => (
                <label
                  key={field}
                  className="flex flex-col items-center rounded-2xl border border-white/10 bg-[#141414] px-2 py-3 focus-within:border-[var(--gym-gold)]/45"
                >
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/70">
                    <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden />
                    {label}
                  </span>
                  <span className="mt-2 flex items-baseline gap-1">
                    <input
                      name={field}
                      value={val}
                      onChange={(e) => setVal(e.target.value)}
                      inputMode="decimal"
                      placeholder="0"
                      className="w-14 border-0 bg-transparent text-center text-2xl font-semibold tabular-nums text-white outline-none placeholder:text-white/50"
                    />
                    <span className="text-xs text-white/50">g</span>
                  </span>
                </label>
              ))}
            </div>

            {hasMacros ? (
              <div aria-hidden className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <span className="bg-sky-400" style={{ flexGrow: p * 4 }} />
                <span className="bg-amber-400" style={{ flexGrow: c * 4 }} />
                <span className="bg-rose-400" style={{ flexGrow: f * 9 }} />
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-white/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <button
              type="submit"
              disabled={savePending}
              className="gold-btn inline-flex h-12 w-full items-center justify-center rounded-full text-base font-semibold text-black disabled:opacity-55"
            >
              {savePending
                ? "Zapisuję…"
                : finalKcal
                  ? `Dodaj · ${finalKcal} kcal`
                  : "Dodaj do dziennika"}
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
        <p className="relative mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
          {kicker}
        </p>
        <h1 className="relative mt-1.5 text-[28px] font-semibold leading-tight tracking-tight text-white">
          Dodaj do dziennika
        </h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={scanBusy}
            onClick={() => setScanOpen(true)}
            className="gold-btn col-span-2 inline-flex h-14 items-center justify-center gap-2.5 rounded-2xl px-3 text-[15px] font-bold text-black disabled:opacity-55"
          >
            {scanBusy ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <ScanBarcode className="h-5 w-5" aria-hidden />
            )}
            Skanuj kod kreskowy
          </button>
          <button
            type="button"
            onClick={onOpenDish}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.04] px-3 text-[13px] font-semibold text-white transition active:bg-white/[0.08]"
          >
            <UtensilsCrossed className="h-[18px] w-[18px] text-[var(--gym-gold)]" aria-hidden />
            Dania z diety
          </button>
          <button
            type="button"
            disabled={scanBusy}
            onClick={() => setScanOpen(true)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.04] px-3 text-[13px] font-semibold text-white transition active:bg-white/[0.08] disabled:opacity-55"
          >
            <Camera className="h-[18px] w-[18px] text-[var(--gym-gold)]" aria-hidden />
            Etykieta
          </button>
        </div>

        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/50"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => {
              setListTab("search");
              setQuery(e.target.value);
            }}
            placeholder="Szukaj produktu: serek, ryż, jabłko…"
            aria-label="Szukaj produktu"
            autoComplete="off"
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#161616] pl-10 pr-3.5 text-[14px] text-white outline-none placeholder:text-white/50 focus:border-[var(--gym-gold)]/45"
          />
        </div>

        {emptySearch ? (
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {(
              [
                { label: "Ostatnie", hint: "Powtórz z historii", icon: Clock, onClick: () => setListTab("recents") },
                { label: "Ulubione", hint: "Twoje zapisane", icon: Heart, onClick: () => setListTab("favorites") },
                { label: "Nowy produkt", hint: "Dodaj własny", icon: Plus, onClick: () => setSub("product") },
                { label: "Szybkie dodawanie", hint: "Same kalorie i makro", icon: Zap, onClick: () => setSub("quick") },
              ] as const
            ).map(({ label, hint, icon: Icon, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className="flex min-h-[84px] flex-col items-start justify-between rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-3 text-left transition active:bg-white/[0.08]"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-white">{label}</span>
                  <span className="block text-[11px] text-white/50">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {showBrowseChrome ? (
          <>
            <div className="mt-4 grid grid-cols-3 gap-1 rounded-full border border-white/[0.1] bg-white/[0.04] p-1">
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
                    "min-h-9 rounded-full px-3 text-[12px] font-semibold transition",
                    listTab === tab.id
                      ? "bg-[var(--gym-gold)]/16 text-[var(--gym-gold)] shadow-[inset_0_0_0_1px_rgba(221,187,109,0.45)]"
                      : "text-white/55",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
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
                  <Loader2 className="h-6 w-6 animate-spin text-white/50" />
                </div>
              ) : products.length === 0 ? (
                <p className="py-6 text-[13px] text-white/50">
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
                          <p className="mt-0.5 text-[12px] text-white/50">
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
                          <span className="mt-0.5 block text-[10px] text-white/50">
                            / {prod.servingLabel || "porcja"}
                          </span>
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
