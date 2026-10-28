"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { AtlasFilters } from "@/components/plany/atlas/atlas-filter-bar";

export type FilterOption = {
  value: string;
  label: string;
  count: number;
};

const TITLES: Record<keyof AtlasFilters, string> = {
  categoryIds: "Partia",
  equipment: "Sprzęt",
  difficulty: "Poziom",
  movement: "Rodzaj ruchu",
};

export function AtlasFilterSheet({
  openKey,
  draft,
  options,
  resultCount,
  onClose,
  onToggle,
  onClear,
  onApply,
}: {
  openKey: keyof AtlasFilters | null;
  draft: string[];
  options: FilterOption[];
  resultCount: number;
  onClose: () => void;
  onToggle: (value: string) => void;
  onClear: () => void;
  onApply: () => void;
}) {
  const single = openKey === "categoryIds";
  return (
    <Sheet open={!!openKey} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[80vh] overflow-y-auto rounded-t-[22px] border-white/10"
      >
        <SheetHeader className="flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-white">
            {openKey ? TITLES[openKey] : "Filtr"}
          </SheetTitle>
          <Button
            type="button"
            variant="ghost"
            className="h-11 px-3 text-[13px]"
            onClick={onClear}
          >
            Wyczyść
          </Button>
        </SheetHeader>
        <div role={single ? "radiogroup" : "group"} className="mt-3 space-y-1 pb-24">
          {options.map((opt) => {
            const checked = draft.includes(opt.value);
            const disabled = opt.count === 0 && !checked;
            return (
              <button
                key={opt.value}
                type="button"
                role={single ? "radio" : "checkbox"}
                aria-checked={checked}
                aria-disabled={disabled}
                disabled={disabled}
                className={cn(
                  "flex h-12 w-full items-center justify-between rounded-2xl px-3 text-left text-[14px]",
                  disabled ? "opacity-40" : "text-white",
                  checked && "bg-[rgba(235,196,74,0.08)]",
                )}
                onClick={() => onToggle(opt.value)}
              >
                <span className="font-medium">{opt.label}</span>
                <span className="tabular-nums text-[12px] text-[var(--gym-text-secondary)]">
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="sticky bottom-0 border-t border-white/10 bg-[rgba(7,7,8,0.96)] py-3">
          <Button
            type="button"
            variant="cta"
            className="h-12 w-full"
            onClick={onApply}
          >
            Pokaż {resultCount} ćwiczeń
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
