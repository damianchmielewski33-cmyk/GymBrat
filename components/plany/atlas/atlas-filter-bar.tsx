"use client";

import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AtlasFilters = {
  categoryIds: string[];
  equipment: string[];
  difficulty: string[];
  movement: string[];
};

export const EMPTY_ATLAS_FILTERS: AtlasFilters = {
  categoryIds: [],
  equipment: [],
  difficulty: [],
  movement: [],
};

export function atlasFiltersActive(f: AtlasFilters): boolean {
  return (
    f.categoryIds.length +
      f.equipment.length +
      f.difficulty.length +
      f.movement.length >
    0
  );
}

const CHIP_DEFS: {
  key: keyof AtlasFilters;
  label: string;
}[] = [
  { key: "categoryIds", label: "Partia" },
  { key: "equipment", label: "Sprzęt" },
  { key: "difficulty", label: "Poziom" },
  { key: "movement", label: "Rodzaj ruchu" },
];

export function AtlasFilterBar({
  filters,
  labels,
  onOpen,
  onClearOne,
  onClearAll,
}: {
  filters: AtlasFilters;
  labels: Partial<Record<keyof AtlasFilters, string>>;
  onOpen: (key: keyof AtlasFilters) => void;
  onClearOne: (key: keyof AtlasFilters, value: string) => void;
  onClearAll: () => void;
}) {
  const active = atlasFiltersActive(filters);
  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CHIP_DEFS.map((chip) => {
          const values = filters[chip.key];
          const on = values.length > 0;
          const text =
            values.length === 0
              ? chip.label
              : values.length === 1
                ? `${chip.label} · ${labels[chip.key] ?? values[0]}`
                : `${chip.label} · ${values.length}`;
          return (
            <button
              key={chip.key}
              type="button"
              aria-pressed={on}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-1 rounded-full border px-3.5 text-[13px]",
                on
                  ? "border-[rgba(235,196,74,0.6)] bg-[rgba(235,196,74,0.1)] font-semibold text-white"
                  : "border-[var(--gym-border-gold)] text-white/80",
              )}
              onClick={() => onOpen(chip.key)}
            >
              {text}
              <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
            </button>
          );
        })}
      </div>
      {active ? (
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["equipment", filters.equipment],
              ["difficulty", filters.difficulty],
              ["movement", filters.movement],
              ["categoryIds", filters.categoryIds],
            ] as const
          ).flatMap(([key, values]) =>
            values.map((v) => (
              <button
                key={`${key}-${v}`}
                type="button"
                className="inline-flex h-11 items-center gap-1 rounded-full border border-white/15 px-3 text-[12px] text-white"
                onClick={() => onClearOne(key, v)}
              >
                {v} <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )),
          )}
          <Button
            type="button"
            variant="ghost"
            className="h-11 px-3 text-[12px]"
            onClick={onClearAll}
          >
            Wyczyść
          </Button>
        </div>
      ) : null}
    </div>
  );
}
