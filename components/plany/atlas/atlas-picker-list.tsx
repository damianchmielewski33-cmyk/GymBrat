"use client";

import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import {
  AtlasFilterBar,
  EMPTY_ATLAS_FILTERS,
  type AtlasFilters,
} from "@/components/plany/atlas/atlas-filter-bar";
import { AtlasFilterSheet } from "@/components/plany/atlas/atlas-filter-sheet";
import { glyphForCategory } from "@/components/plany/atlas/glyph-for-category";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MuscleGlyph } from "@/components/treningi/muscle-glyph";
import {
  MUSCLE_CATEGORIES,
  exerciseMatchesQuery,
  type CatalogExercise,
} from "@/lib/workout-exercise-catalog";
import { cn } from "@/lib/utils";

const PAGE = 40;

export function AtlasPickerList({
  catalog,
  alreadyInPlanIds,
  onAdd,
}: {
  catalog: CatalogExercise[];
  alreadyInPlanIds: string[];
  onAdd: (ex: CatalogExercise) => void;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<AtlasFilters>(EMPTY_ATLAS_FILTERS);
  const [filterOpen, setFilterOpen] = useState<keyof AtlasFilters | null>(null);
  const [filterDraft, setFilterDraft] = useState<string[]>([]);
  const [visible, setVisible] = useState(PAGE);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const searching = query.trim().length >= 2;

  const filtered = useMemo(() => {
    let list = catalog;
    if (filters.categoryIds.length) {
      list = list.filter((e) => filters.categoryIds.includes(e.categoryId));
    }
    if (searching) list = list.filter((e) => exerciseMatchesQuery(e, query));
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }, [catalog, filters.categoryIds, query, searching]);

  const page = filtered.slice(0, visible);

  return (
    <div className="space-y-3 pb-6">
      <Input
        className="h-12"
        placeholder="Szukaj: wyciskanie, bench, wiosłowanie…"
        aria-label="Szukaj ćwiczenia"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setVisible(PAGE);
        }}
      />
      {query.trim().length === 1 ? (
        <p className="text-[12px] text-[var(--gym-text-secondary)]">
          Wpisz co najmniej 2 znaki.
        </p>
      ) : null}

      <AtlasFilterBar
        filters={filters}
        labels={{
          categoryIds: filters.categoryIds
            .map((id) => MUSCLE_CATEGORIES.find((c) => c.id === id)?.label ?? id)
            .join(", "),
        }}
        onOpen={(key) => {
          setFilterDraft([...filters[key]]);
          setFilterOpen(key);
        }}
        onClearOne={(key, value) =>
          setFilters((prev) => ({
            ...prev,
            [key]: prev[key].filter((v) => v !== value),
          }))
        }
        onClearAll={() => setFilters(EMPTY_ATLAS_FILTERS)}
      />

      <p className="text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
        Znaleziono {filtered.length}
      </p>

      {filtered.length === 0 && searching ? (
        <div className="app-card border border-white/10 p-4">
          <p className="font-semibold text-white">
            Brak wyników dla „{query.trim()}”
          </p>
          <p className="mt-1 text-[13px] text-[var(--gym-text-secondary)]">
            Spróbuj krótszej nazwy albo po angielsku.
          </p>
        </div>
      ) : (
        <ul>
          {page.map((ex) => {
            const inPlan = alreadyInPlanIds.filter((id) => id === ex.id).length;
            const added = justAdded === ex.id;
            return (
              <li
                key={ex.id}
                className="flex min-h-16 items-center gap-3 border-b border-white/10 py-3"
              >
                <MuscleGlyph
                  summary={glyphForCategory(ex.categoryId)}
                  size="row"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-white">{ex.name}</p>
                  <p className="text-[12px] text-[var(--gym-text-secondary)]">
                    {inPlan > 0
                      ? `W planie: ${inPlan} razy`
                      : ex.aliasesEn?.[0] ??
                        MUSCLE_CATEGORIES.find((c) => c.id === ex.categoryId)
                          ?.label}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("h-11 w-11 px-0", added && "border-[var(--gym-success)]")}
                  aria-label={`Dodaj ${ex.name} do planu`}
                  onClick={() => {
                    onAdd(ex);
                    setJustAdded(ex.id);
                    window.setTimeout(() => setJustAdded(null), 1500);
                  }}
                >
                  {added ? (
                    <Check className="h-4 w-4 text-[var(--gym-success)]" aria-hidden />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden />
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {visible < filtered.length ? (
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full"
          onClick={() => setVisible((v) => v + PAGE)}
        >
          Pokaż kolejne {Math.min(PAGE, filtered.length - visible)}
        </Button>
      ) : null}

      <AtlasFilterSheet
        openKey={filterOpen}
        draft={filterDraft}
        options={
          filterOpen === "categoryIds"
            ? MUSCLE_CATEGORIES.map((c) => ({
                value: c.id,
                label: c.label,
                count: catalog.filter((e) => e.categoryId === c.id).length,
              }))
            : []
        }
        resultCount={filtered.length}
        onClose={() => setFilterOpen(null)}
        onClear={() => setFilterDraft([])}
        onToggle={(value) => {
          if (filterOpen === "categoryIds") {
            setFilterDraft((prev) => (prev.includes(value) ? [] : [value]));
            return;
          }
          setFilterDraft((prev) =>
            prev.includes(value)
              ? prev.filter((v) => v !== value)
              : [...prev, value],
          );
        }}
        onApply={() => {
          if (!filterOpen) return;
          setFilters((prev) => ({ ...prev, [filterOpen]: filterDraft }));
          setFilterOpen(null);
        }}
      />
    </div>
  );
}
