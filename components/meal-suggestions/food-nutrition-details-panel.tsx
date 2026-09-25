"use client";

import {
  buildNutritionRows,
  carbohydrateExchanges,
  classifyIngredient,
  formatNutrientValue,
  gymbratNutritionScore,
  proteinFatExchanges,
  splitIngredients,
  type IngredientTagKind,
} from "@/lib/food-nutrition";
import type { FoodProduct } from "@/lib/food-products-types";
import { cn } from "@/lib/utils";

const TAG_STYLES: Record<IngredientTagKind, string> = {
  healthy: "border-l-[3px] border-l-emerald-400 bg-emerald-500/10 text-emerald-100",
  safe: "border-l-[3px] border-l-sky-400 bg-sky-500/10 text-sky-100",
  harmful: "border-l-[3px] border-l-rose-400 bg-rose-500/10 text-rose-100",
};

const TAG_LABELS: Record<IngredientTagKind, string> = {
  healthy: "Zdrowy",
  safe: "Bezpieczny",
  harmful: "Szkodliwy",
};

function IngredientGroup({
  kind,
  items,
}: {
  kind: IngredientTagKind;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-white/45">
        {TAG_LABELS[kind]}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={`${kind}-${item}`}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] leading-tight",
              TAG_STYLES[kind],
            )}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Rozwinięta karta odżywcza jak w Fitatu: tabela, WW/WBT, składniki, ocena. */
export function FoodNutritionDetailsPanel({
  product,
  macrosPer100,
}: {
  product: FoodProduct;
  macrosPer100: {
    calories: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
  };
}) {
  const details = product.details;
  const rows = buildNutritionRows(macrosPer100, details);
  const ww = carbohydrateExchanges(macrosPer100.carbsG);
  const wbt = proteinFatExchanges(macrosPer100.proteinG, macrosPer100.fatG);
  const score = gymbratNutritionScore(product);
  const ingredients = splitIngredients(details?.ingredientsText);
  const byKind: Record<IngredientTagKind, string[]> = {
    healthy: [],
    safe: [],
    harmful: [],
  };
  for (const item of ingredients) {
    byKind[classifyIngredient(item)].push(item);
  }

  return (
    <div className="mt-4 space-y-5">
      <div className="overflow-hidden rounded-xl border border-white/8">
        {rows.map((row, i) => {
          if (row.section) {
            return (
              <div
                key={row.id}
                className="border-t border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/55"
              >
                {row.label}
              </div>
            );
          }
          return (
            <div
              key={row.id}
              className={cn(
                "flex items-baseline justify-between gap-3 px-3 py-2.5 text-sm",
                i % 2 === 0 ? "bg-white/[0.03]" : "bg-transparent",
                row.indent && "pl-6 text-white/70",
              )}
            >
              <span className={cn(!row.indent && "font-medium text-white/90")}>
                {row.label}
              </span>
              <span className="shrink-0 tabular-nums text-white/55">
                {formatNutrientValue(row.value, "")}
              </span>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/45">
          Pozostałe
        </p>
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-white/55">WW</span>{" "}
            <span className="font-semibold tabular-nums text-white">
              {ww.toFixed(1).replace(".", ",")}*
            </span>
          </div>
          <div>
            <span className="text-white/55">WBT</span>{" "}
            <span className="font-semibold tabular-nums text-white">
              {wbt.toFixed(1).replace(".", ",")}
            </span>
          </div>
        </div>
        <p className="mt-2 text-[10px] leading-snug text-white/35">
          *Opiera się o dane, które posiadamy (np. które dostarczył producent)
        </p>
      </div>

      {(ingredients.length > 0 || score) && (
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/45">
                Składniki
              </p>
              {details?.ingredientsText ? (
                <p className="text-sm leading-relaxed text-white/75">
                  {details.ingredientsText}
                </p>
              ) : (
                <p className="text-sm text-white/40">Brak danych o składzie</p>
              )}
            </div>
            {score ? (
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--gym-gold)] text-center text-black shadow-sm">
                <span className="text-[8px] font-semibold uppercase leading-tight tracking-wide opacity-80">
                  GymBrat
                </span>
                <span className="text-lg font-bold leading-none tabular-nums">
                  {String(score.score).replace(".", ",")}
                </span>
                <span className="text-[9px] opacity-70">/{score.max}</span>
              </div>
            ) : null}
          </div>
          <IngredientGroup kind="healthy" items={byKind.healthy} />
          <IngredientGroup kind="safe" items={byKind.safe} />
          <IngredientGroup kind="harmful" items={byKind.harmful} />
        </div>
      )}
    </div>
  );
}
