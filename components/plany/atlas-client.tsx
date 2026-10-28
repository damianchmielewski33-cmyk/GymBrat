"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, HeartPulse } from "lucide-react";
import { getUserExerciseNote, type UserExerciseNoteDTO } from "@/actions/user-exercise-notes";
import {
  AtlasFilterBar,
  EMPTY_ATLAS_FILTERS,
  type AtlasFilters,
} from "@/components/plany/atlas/atlas-filter-bar";
import { AtlasFilterSheet } from "@/components/plany/atlas/atlas-filter-sheet";
import { ExerciseCardSheet } from "@/components/plany/atlas/exercise-card-sheet";
import { AppPageHeader } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { InlineBanner } from "@/components/ui/inline-banner";
import { Input } from "@/components/ui/input";
import { MuscleGlyph } from "@/components/treningi/muscle-glyph";
import { glyphForCategory } from "@/components/plany/atlas/glyph-for-category";
import {
  MUSCLE_CATEGORIES,
  exerciseMatchesQuery,
  type CatalogExercise,
} from "@/lib/workout-exercise-catalog";

const PAGE = 40;

const FAMILIES: { title: string; ids: string[] }[] = [
  {
    title: "Góra ciała",
    ids: [
      "chest",
      "back_upper",
      "back_mid",
      "back_lower",
      "shoulders",
      "biceps",
      "triceps",
      "forearms",
    ],
  },
  { title: "Tułów", ids: ["core"] },
  {
    title: "Dół ciała",
    ids: ["quads", "glutes", "hamstrings", "calves"],
  },
  { title: "Cardio", ids: ["cardio"] },
];

const EQUIPMENT_OPTIONS = [
  "sztanga",
  "hantle",
  "maszyna",
  "wyciąg",
  "kettlebell",
  "własna masa",
  "inne",
];
const DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "początkujący" },
  { value: "intermediate", label: "średni" },
  { value: "advanced", label: "zaawansowany" },
];
const MOVEMENT_OPTIONS = [
  "wyciskanie",
  "ciągnienie",
  "przysiad",
  "martwy ciąg",
  "izolacja",
  "cardio",
];

function matchesMovement(ex: CatalogExercise, tags: string[]): boolean {
  if (tags.length === 0) return true;
  const hay = `${ex.name} ${(ex.aliasesEn ?? []).join(" ")} ${(ex.aliasesPl ?? []).join(" ")}`.toLowerCase();
  return tags.some((t) => hay.includes(t.toLowerCase()));
}

function matchesEquipment(ex: CatalogExercise, tags: string[]): boolean {
  if (tags.length === 0) return true;
  const eq = (ex.equipment ?? []).map((e) => e.toLowerCase());
  if (eq.length === 0) return false;
  return tags.some((t) => eq.some((e) => e.includes(t.toLowerCase())));
}

type SortMode = "az" | "relevance" | "difficulty" | "category";

export function AtlasClient({
  catalog,
  counts,
}: {
  catalog: CatalogExercise[];
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const partia = searchParams.get("partia");
  const cwiczenie = searchParams.get("cwiczenie");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<AtlasFilters>(EMPTY_ATLAS_FILTERS);
  const [filterOpen, setFilterOpen] = useState<keyof AtlasFilters | null>(null);
  const [filterDraft, setFilterDraft] = useState<string[]>([]);
  const [sort, setSort] = useState<SortMode>("az");
  const [visible, setVisible] = useState(PAGE);
  const [privateNote, setPrivateNote] = useState<UserExerciseNoteDTO | null>(null);
  const [, startNote] = useTransition();

  const total = catalog.length;
  const category = MUSCLE_CATEGORIES.find((c) => c.id === partia);
  const searching = query.trim().length >= 2;
  const listMode = Boolean(partia) || searching;

  useEffect(() => {
    setVisible(PAGE);
  }, [partia, query, filters, sort]);

  useEffect(() => {
    if (searching) setSort("relevance");
  }, [searching]);

  const selectedExercise = useMemo(
    () => (cwiczenie ? catalog.find((e) => e.id === cwiczenie) ?? null : null),
    [catalog, cwiczenie],
  );

  useEffect(() => {
    if (!selectedExercise) {
      setPrivateNote(null);
      return;
    }
    startNote(async () => {
      setPrivateNote(await getUserExerciseNote(selectedExercise.id));
    });
  }, [selectedExercise]);

  const filtered = useMemo(() => {
    let list = catalog;
    const cats =
      filters.categoryIds.length > 0
        ? filters.categoryIds
        : partia
          ? [partia]
          : [];
    if (cats.length) {
      list = list.filter((e) => cats.includes(e.categoryId));
    }
    if (searching) {
      list = list.filter((e) => exerciseMatchesQuery(e, query));
    }
    list = list.filter(
      (e) =>
        matchesEquipment(e, filters.equipment) &&
        (filters.difficulty.length === 0 ||
          (e.difficulty != null && filters.difficulty.includes(e.difficulty))) &&
        matchesMovement(e, filters.movement),
    );

    const next = [...list];
    if (sort === "az" || sort === "relevance") {
      next.sort((a, b) => a.name.localeCompare(b.name, "pl"));
    } else if (sort === "difficulty") {
      const order = { beginner: 0, intermediate: 1, advanced: 2 };
      next.sort(
        (a, b) =>
          (order[a.difficulty as keyof typeof order] ?? 9) -
            (order[b.difficulty as keyof typeof order] ?? 9) ||
          a.name.localeCompare(b.name, "pl"),
      );
    } else {
      next.sort(
        (a, b) =>
          a.categoryId.localeCompare(b.categoryId) ||
          a.name.localeCompare(b.name, "pl"),
      );
    }
    return next;
  }, [catalog, filters, partia, query, searching, sort]);

  const page = filtered.slice(0, visible);

  function setPartia(id: string | null) {
    const sp = new URLSearchParams(searchParams.toString());
    if (id) sp.set("partia", id);
    else sp.delete("partia");
    sp.delete("cwiczenie");
    router.push(`${pathname}?${sp.toString()}`);
  }

  function openExercise(id: string) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("cwiczenie", id);
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  function closeExercise() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("cwiczenie");
    const q = sp.toString();
    router.push(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  function openFilter(key: keyof AtlasFilters) {
    setFilterDraft([...filters[key]]);
    setFilterOpen(key);
  }

  function filterOptions(key: keyof AtlasFilters) {
    if (key === "categoryIds") {
      return MUSCLE_CATEGORIES.map((c) => ({
        value: c.id,
        label: c.label,
        count: catalog.filter((e) => e.categoryId === c.id).length,
      }));
    }
    if (key === "equipment") {
      return EQUIPMENT_OPTIONS.map((v) => ({
        value: v,
        label: v,
        count: catalog.filter((e) => matchesEquipment(e, [v])).length,
      }));
    }
    if (key === "difficulty") {
      return DIFFICULTY_OPTIONS.map((d) => ({
        value: d.value,
        label: d.label,
        count: catalog.filter((e) => e.difficulty === d.value).length,
      }));
    }
    return MOVEMENT_OPTIONS.map((v) => ({
      value: v,
      label: v,
      count: catalog.filter((e) => matchesMovement(e, [v])).length,
    }));
  }

  const draftResultCount = useMemo(() => {
    if (!filterOpen) return filtered.length;
    const next = { ...filters, [filterOpen]: filterDraft };
    return catalog.filter((e) => {
      const cats =
        next.categoryIds.length > 0
          ? next.categoryIds
          : partia
            ? [partia]
            : [];
      if (cats.length && !cats.includes(e.categoryId)) return false;
      if (searching && !exerciseMatchesQuery(e, query)) return false;
      if (!matchesEquipment(e, next.equipment)) return false;
      if (
        next.difficulty.length &&
        !(e.difficulty && next.difficulty.includes(e.difficulty))
      ) {
        return false;
      }
      if (!matchesMovement(e, next.movement)) return false;
      return true;
    }).length;
  }, [catalog, filterDraft, filterOpen, filters, filtered.length, partia, query, searching]);

  return (
    <div className="px-1 pb-24 pt-1 sm:px-0">
      <div className="mb-1 flex items-center gap-1">
        <Link
          href={partia || searching ? "/plany/atlas" : "/plany"}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white"
          aria-label="Wstecz"
          onClick={(e) => {
            if (partia) {
              e.preventDefault();
              setPartia(null);
            }
          }}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
      </div>

      <AppPageHeader
        kicker="Trening"
        title={category?.label ?? "Atlas ćwiczeń"}
        description={
          category
            ? `${counts[category.id] ?? 0} ćwiczeń w partii`
            : `${total} ćwiczeń w 14 partiach. Szukaj po polsku lub po angielsku.`
        }
      />

      <div className="mt-4">
        <Input
          className="h-12"
          placeholder="Szukaj: wyciskanie, bench, wiosłowanie…"
          aria-label="Szukaj ćwiczenia"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query.trim().length === 1 ? (
          <p className="mt-1.5 text-[12px] text-[var(--gym-text-secondary)]">
            Wpisz co najmniej 2 znaki.
          </p>
        ) : null}
      </div>

      {!listMode ? (
        <div className="mt-4 space-y-4">
          {FAMILIES.map((fam) => (
            <section key={fam.title}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
                {fam.title} · {fam.ids.length} partii
              </p>
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                {fam.ids.map((id) => {
                  const cat = MUSCLE_CATEGORIES.find((c) => c.id === id);
                  if (!cat) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      className="app-card flex min-h-[84px] items-center gap-2.5 p-3 text-left"
                      onClick={() => setPartia(id)}
                      aria-label={`${cat.label}, ${counts[id] ?? 0} ćwiczeń`}
                    >
                      {id === "cardio" ? (
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] text-[var(--gym-gold)]">
                          <HeartPulse className="h-5 w-5" aria-hidden />
                        </span>
                      ) : (
                        <MuscleGlyph
                          summary={glyphForCategory(id)}
                          size="row"
                        />
                      )}
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold leading-tight text-white">
                          {cat.label}
                        </span>
                        <span className="mt-0.5 block text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
                          {counts[id] ?? 0}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <AtlasFilterBar
            filters={filters}
            labels={{
              categoryIds: filters.categoryIds
                .map(
                  (id) =>
                    MUSCLE_CATEGORIES.find((c) => c.id === id)?.label ?? id,
                )
                .join(", "),
              difficulty: filters.difficulty
                .map(
                  (d) =>
                    DIFFICULTY_OPTIONS.find((x) => x.value === d)?.label ?? d,
                )
                .join(", "),
            }}
            onOpen={openFilter}
            onClearOne={(key, value) =>
              setFilters((prev) => ({
                ...prev,
                [key]: prev[key].filter((v) => v !== value),
              }))
            }
            onClearAll={() => setFilters(EMPTY_ATLAS_FILTERS)}
          />

          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
              Znaleziono {filtered.length}
            </p>
            <label className="flex h-11 items-center gap-2 text-[12px] text-white">
              Sortuj:
              <select
                className="h-11 rounded-2xl border border-[var(--gym-border-gold)] bg-black/50 px-2 text-[12px]"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
              >
                {searching ? <option value="relevance">Trafność</option> : null}
                <option value="az">A–Z</option>
                <option value="difficulty">Poziom</option>
                <option value="category">Partia</option>
              </select>
            </label>
          </div>

          {filtered.length > 200 ? (
            <InlineBanner variant="info">
              Wyników jest dużo: {filtered.length}. Zawęź filtrem albo wpisz nazwę.
            </InlineBanner>
          ) : null}

          {filtered.length === 0 ? (
            <div className="app-card border border-white/10 p-4">
              <p className="font-semibold text-white">
                {searching
                  ? `Brak wyników dla „${query.trim()}”`
                  : "Brak ćwiczeń dla tych filtrów."}
              </p>
              <p className="mt-1 text-[13px] text-[var(--gym-text-secondary)]">
                {searching
                  ? "Spróbuj krótszej nazwy albo po angielsku."
                  : "Usuń jeden filtr, aby zobaczyć więcej."}
              </p>
              {!searching ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 h-11 w-full"
                  onClick={() => setFilters(EMPTY_ATLAS_FILTERS)}
                >
                  Wyczyść wszystkie filtry
                </Button>
              ) : null}
            </div>
          ) : (
            <ul>
              {page.map((ex) => (
                <li key={ex.id}>
                  <button
                    type="button"
                    className="flex min-h-16 w-full items-center gap-3 border-b border-white/10 py-3 text-left"
                    onClick={() => openExercise(ex.id)}
                  >
                    <MuscleGlyph
                      summary={glyphForCategory(ex.categoryId)}
                      size="row"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-white">
                        {ex.name}
                      </p>
                      <p className="truncate text-[12px] text-[var(--gym-text-secondary)]">
                        {[
                          ex.aliasesEn?.[0],
                          ex.equipment?.[0],
                          DIFFICULTY_OPTIONS.find((d) => d.value === ex.difficulty)
                            ?.label,
                        ]
                          .filter(Boolean)
                          .join(" · ") ||
                          MUSCLE_CATEGORIES.find((c) => c.id === ex.categoryId)
                            ?.label}
                      </p>
                    </div>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-white/40"
                      aria-hidden
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {filtered.length > 0 ? (
            <p className="text-center text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
              Pokazano {Math.min(visible, filtered.length)} z {filtered.length}
            </p>
          ) : null}
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
        </div>
      )}

      <AtlasFilterSheet
        openKey={filterOpen}
        draft={filterDraft}
        options={filterOpen ? filterOptions(filterOpen) : []}
        resultCount={draftResultCount}
        onClose={() => setFilterOpen(null)}
        onClear={() => setFilterDraft([])}
        onToggle={(value) => {
          if (filterOpen === "categoryIds") {
            setFilterDraft((prev) =>
              prev.includes(value) ? [] : [value],
            );
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

      <ExerciseCardSheet
        exercise={selectedExercise}
        open={!!selectedExercise}
        onOpenChange={(o) => !o && closeExercise()}
        glyph={
          selectedExercise
            ? glyphForCategory(selectedExercise.categoryId)
            : null
        }
        privateNote={privateNote}
      />
    </div>
  );
}
