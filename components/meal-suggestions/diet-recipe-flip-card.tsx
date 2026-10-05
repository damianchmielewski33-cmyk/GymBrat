"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { RecipeImage } from "@/components/meal-suggestions/recipe-image";
import { AddToMealLogSheet } from "@/components/meal-suggestions/add-to-meal-log-sheet";
import {
  enrichRecipeContent,
  splitIngredientDisplay,
} from "@/lib/meal-recipe-enrich";
import type { CatalogMeal } from "@/lib/meal-catalog-types";
import type { DietDiarySlot } from "@/lib/diet-diary-slots";
import {
  ingredientPreview,
  recipeDifficulty,
} from "@/lib/diet-recipe-match";
import { cn } from "@/lib/utils";

function ChefHats({ level }: { level: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Trudność ${level} z 3`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            "text-sm",
            i <= level ? "text-[var(--gym-gold)]" : "text-white/20",
          )}
        >
          👨‍🍳
        </span>
      ))}
    </div>
  );
}

function CloseButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label="Zamknij przepis"
      onClick={onClick}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/75 text-white backdrop-blur-sm",
        "hover:border-[var(--gym-gold)]/55 hover:bg-[var(--gym-gold)]/15 hover:text-[var(--gym-gold)]",
        className,
      )}
    >
      <X className="h-5 w-5" strokeWidth={2.25} />
    </button>
  );
}

export function DietRecipeFlipCard({
  meal,
  open,
  onClose,
  dateKey,
  diarySlot,
  scale = 1,
  targetMacroLine,
}: {
  meal: CatalogMeal | null;
  open: boolean;
  onClose: () => void;
  dateKey: string;
  diarySlot: DietDiarySlot;
  scale?: number;
  targetMacroLine?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [side, setSide] = useState<"photo" | "recipe">("photo");
  const enriched = useMemo(
    () => (meal ? enrichRecipeContent(meal) : null),
    [meal],
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setSide("photo");
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted || !open || !meal || !enriched) return null;

  const macros = meal.approximateMacros;
  const diff = recipeDifficulty(meal.prepMinutes);
  const preview = ingredientPreview(meal, 6);
  const scaled = Math.abs(scale - 1) >= 0.05;

  function handleClose() {
    setSide("photo");
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[1200] flex flex-col bg-black px-3 pt-[max(0.5rem,env(safe-area-inset-top))]"
      role="dialog"
      aria-modal="true"
      aria-label={meal.title}
    >
      <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
        <p className="pl-1 text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--gym-gold)]">
          Przepis
        </p>
        <CloseButton onClick={handleClose} />
      </div>

      <div className="relative mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#141414]">
        <CloseButton
          onClick={handleClose}
          className="absolute right-3 top-3 z-20 h-9 w-9"
        />

        <button
          type="button"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto text-left"
          onClick={() => setSide((s) => (s === "photo" ? "recipe" : "photo"))}
        >
          {side === "photo" ? (
            <>
              <p className="px-4 pt-4 pr-14 text-center text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--gym-gold)]">
                GymBrat
              </p>
              <div className="relative mx-4 mt-3 aspect-[4/3] max-h-[42vh] overflow-hidden rounded-2xl">
                <RecipeImage
                  recipe={meal}
                  className="h-full w-full object-cover"
                  alt={meal.title}
                />
              </div>
              <div className="flex flex-col px-5 pb-4 pt-4">
                <h2 className="text-center text-xl font-bold uppercase leading-snug tracking-wide text-white">
                  {meal.title}
                </h2>
                <p className="mt-2 text-center text-xs leading-relaxed text-white/55">
                  {preview}
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col px-5 py-5 pr-14">
              <h2 className="text-2xl font-semibold leading-tight text-white">
                {meal.title}
              </h2>
              <p className="mt-2 text-sm font-semibold tabular-nums text-[var(--gym-gold)]">
                {Math.round(macros.proteinG)}B / {Math.round(macros.carbsG)}W /{" "}
                {Math.round(macros.fatG)}T · {Math.round(macros.calories)} KCAL
              </p>
              {targetMacroLine || scaled ? (
                <p className="mt-1 text-[11px] text-white/45">
                  {targetMacroLine ? (
                    <>
                      Cel posiłku:{" "}
                      <span className="tabular-nums text-white/65">
                        {targetMacroLine}
                      </span>
                    </>
                  ) : null}
                  {targetMacroLine && scaled ? " · " : null}
                  {scaled ? (
                    <span className="tabular-nums">
                      porcja ×{scale.toFixed(1)}
                    </span>
                  ) : null}
                </p>
              ) : null}
              <div className="mt-2">
                <ChefHats level={diff} />
              </div>

              <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                Składniki
              </p>
              <ul className="mt-2 space-y-1.5">
                {enriched.ingredients.map((line) => {
                  const { amount, name } = splitIngredientDisplay(line);
                  return (
                    <li key={line} className="flex gap-2 text-sm text-white/85">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gym-gold)]" />
                      <span>
                        {amount ? (
                          <span className="text-white/55">{amount} </span>
                        ) : null}
                        {name || line}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                Przygotowanie
              </p>
              <ol className="mt-2 list-decimal space-y-2 pl-4 text-sm leading-relaxed text-white/80">
                {enriched.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </button>
      </div>

      {/* Stopka CTA nad dolną nawigacją / safe-area */}
      <div
        className="mx-auto w-full max-w-md shrink-0 bg-black pt-3"
        style={{
          paddingBottom:
            "max(1rem, calc(5.75rem + env(safe-area-inset-bottom, 0px)))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-center font-mono text-[11px] uppercase tracking-wide text-white/45">
          {side === "photo"
            ? "Dotknij karty, żeby zobaczyć przepis"
            : "Dotknij karty, żeby wrócić do zdjęcia"}
        </p>
        <AddToMealLogSheet
          dateKey={dateKey}
          presetName={meal.title}
          proteinG={macros.proteinG}
          fatG={macros.fatG}
          carbsG={macros.carbsG}
          calories={macros.calories}
          defaultSlot={diarySlot}
          triggerLabel="Dodaj do jadłospisu"
          triggerClassName="inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--gym-gold)] text-sm font-semibold text-black shadow-[0_4px_16px_rgba(235,196,74,0.28)]"
        />
      </div>
    </div>,
    document.body,
  );
}
