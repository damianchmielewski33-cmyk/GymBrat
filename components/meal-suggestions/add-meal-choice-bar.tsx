"use client";

import { useActionState, useEffect, useState } from "react";
import { Calculator, ChefHat, PackagePlus, X } from "lucide-react";
import { addMealLogAction, type MealLogFormState } from "@/actions/meal-log";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { kcalFromMacros, parseMacroGrams } from "@/lib/kcal-from-macros";
import {
  DIET_DIARY_SLOT_LABELS,
  type DietDiarySlot,
} from "@/lib/diet-diary-slots";
import { cn } from "@/lib/utils";

type Mode = "menu" | "product" | "quick";

type Props = {
  open: boolean;
  slot: DietDiarySlot;
  dateKey: string;
  onClose: () => void;
  onOpenSearch: () => void;
  onOpenDish: () => void;
  onSaved: () => void;
};

/**
 * Dolny wybór przy dodawaniu do sekcji: nowy produkt / potrawa / szybkie makro.
 */
export function AddMealChoiceBar({
  open,
  slot,
  dateKey,
  onClose,
  onOpenSearch,
  onOpenDish,
  onSaved,
}: Props) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [mode, setMode] = useState<Mode>("menu");
  const [name, setName] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [kcal, setKcal] = useState("");

  const [state, formAction, pending] = useActionState(
    addMealLogAction,
    {} as MealLogFormState,
  );

  useEffect(() => {
    if (!open) {
      setMode("menu");
      setName("");
      setProtein("");
      setFat("");
      setCarbs("");
      setKcal("");
    }
  }, [open]);

  useEffect(() => {
    if (state?.ok) {
      notifySaved(
        mode === "product"
          ? "Produkt dodany do dziennika."
          : "Szybki wpis makro zapisany.",
      );
      onSaved();
      onClose();
    } else if (state?.error) {
      notifyError(state.error);
    }
  }, [state, mode, notifySaved, notifyError, onSaved, onClose]);

  if (!open) return null;

  const p = parseMacroGrams(protein);
  const f = parseMacroGrams(fat);
  const c = parseMacroGrams(carbs);
  const hasMacros = p > 0 || f > 0 || c > 0;
  const computedKcal = hasMacros ? kcalFromMacros(p, f, c) : null;
  const manualKcal = parseMacroGrams(kcal);
  const finalKcal =
    manualKcal > 0 ? Math.round(manualKcal) : computedKcal;

  if (mode === "menu") {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[175] border-t border-white/10 bg-[#121212] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
            Dodaj do: {DIET_DIARY_SLOT_LABELS[slot]}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setMode("product")}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/12 bg-white/[0.04] px-2 py-3 text-center"
            >
              <PackagePlus className="h-5 w-5 text-[var(--gym-gold)]" />
              <span className="text-[11px] font-semibold leading-tight text-white">
                Nowy produkt
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenDish();
                onClose();
              }}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/12 bg-white/[0.04] px-2 py-3 text-center"
            >
              <ChefHat className="h-5 w-5 text-[var(--gym-gold)]" />
              <span className="text-[11px] font-semibold leading-tight text-white">
                Nowa potrawa
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode("quick")}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/12 bg-white/[0.04] px-2 py-3 text-center"
            >
              <Calculator className="h-5 w-5 text-[var(--gym-gold)]" />
              <span className="text-[11px] font-semibold leading-tight text-white">
                Szybkie dodawanie
              </span>
            </button>
          </div>
          <button
            type="button"
            onClick={onOpenSearch}
            className="mt-1 text-center text-xs text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
          >
            Albo wyszukaj produkt w bazie
          </button>
        </div>
      </div>
    );
  }

  const title =
    mode === "product" ? "Nowy produkt" : "Szybkie dodawanie";
  const subtitle =
    mode === "product"
      ? "Jeśli nie ma go w bazie — wpisz nazwę i makro (na porcję / 100 g)."
      : "Wpisz białko, węglowodany, tłuszcz i kalorie zjedzonego posiłku.";

  return (
    <div className="fixed inset-0 z-[180] flex flex-col bg-[#0c0c0c] text-white">
      <header className="flex items-center gap-2 border-b border-white/10 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label="Wróć"
          onClick={() => setMode("menu")}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/85"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">{title}</p>
          <p className="text-xs text-white/45">
            {DIET_DIARY_SLOT_LABELS[slot]} · {subtitle}
          </p>
        </div>
      </header>

      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="date" value={dateKey} />
        <input type="hidden" name="slot" value={slot} />
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
              Nazwa
            </span>
            <input
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required={mode === "product"}
              placeholder={
                mode === "product" ? "np. Skyr naturalny" : "np. Kanapka z pracy"
              }
              className="mt-1.5 h-12 w-full rounded-xl border border-white/12 bg-[#121212] px-3 text-sm text-white outline-none placeholder:text-white/30"
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["proteinG", "Białko (g)", protein, setProtein],
                ["carbsG", "Węgle (g)", carbs, setCarbs],
                ["fatG", "Tłuszcz (g)", fat, setFat],
              ] as const
            ).map(([field, label, val, setVal]) => (
              <label key={field} className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
                  {label}
                </span>
                <input
                  name={field}
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  inputMode="decimal"
                  className="mt-1.5 h-12 w-full rounded-xl border border-white/12 bg-[#121212] px-3 text-sm tabular-nums text-white outline-none"
                />
              </label>
            ))}
          </div>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
              Kalorie (kcal)
            </span>
            <input
              name="calories"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              inputMode="numeric"
              placeholder={
                computedKcal != null
                  ? `z makro ≈ ${computedKcal}`
                  : "opcjonalnie / z makro"
              }
              className="mt-1.5 h-12 w-full rounded-xl border border-white/12 bg-[#121212] px-3 text-sm tabular-nums text-white outline-none placeholder:text-white/30"
            />
            {finalKcal != null ? (
              <p className="mt-1 text-xs text-white/40">
                Do zapisu:{" "}
                <span className="font-semibold text-[var(--gym-gold)]">
                  {finalKcal} kcal
                </span>
              </p>
            ) : null}
          </label>
        </div>
        <div className="shrink-0 border-t border-white/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <button
            type="submit"
            disabled={pending}
            className={cn(
              "gold-btn inline-flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold disabled:opacity-55",
            )}
          >
            {pending ? "Zapisuję…" : "Zapisz w dzienniku"}
          </button>
        </div>
      </form>
    </div>
  );
}
