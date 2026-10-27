"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, HeartPulse } from "lucide-react";
import { AppPageHeader } from "@/components/layout/screen";
import { Input } from "@/components/ui/input";
import { MuscleGlyph } from "@/components/treningi/muscle-glyph";
import {
  MUSCLE_CATEGORIES,
  exerciseMatchesQuery,
  type CatalogExercise,
} from "@/lib/workout-exercise-catalog";
import type { PlanDayMuscleSummary } from "@/lib/plan-day-muscles";
import { cn } from "@/lib/utils";

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

function glyphForCategory(categoryId: string): PlanDayMuscleSummary | null {
  const map: Record<string, PlanDayMuscleSummary["groups"][number]> = {
    chest: "klatka",
    back_upper: "plecy",
    back_mid: "plecy",
    back_lower: "plecy",
    shoulders: "barki",
    biceps: "ramiona",
    triceps: "ramiona",
    core: "brzuch",
    quads: "nogi",
    glutes: "posladki",
    hamstrings: "nogi",
    calves: "lydki",
  };
  const g = map[categoryId];
  if (!g) return null;
  const label =
    MUSCLE_CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId;
  const view =
    categoryId.startsWith("back") ||
    categoryId === "glutes" ||
    categoryId === "hamstrings" ||
    categoryId === "calves"
      ? "back"
      : "front";
  return { groups: [g], labels: [label], view };
}

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
  const [query, setQuery] = useState("");

  const total = catalog.length;
  const category = MUSCLE_CATEGORIES.find((c) => c.id === partia);

  const results = useMemo(() => {
    const q = query.trim();
    if (q.length === 1) return [];
    let list = catalog;
    if (partia) list = list.filter((e) => e.categoryId === partia);
    if (q.length >= 2) {
      list = list.filter((e) => exerciseMatchesQuery(e, q));
    }
    return [...list]
      .sort((a, b) => a.name.localeCompare(b.name, "pl"))
      .slice(0, 40);
  }, [catalog, partia, query]);

  function setPartia(id: string | null) {
    const sp = new URLSearchParams(searchParams.toString());
    if (id) sp.set("partia", id);
    else sp.delete("partia");
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="px-1 pb-24 pt-1 sm:px-0">
      <div className="mb-1 flex items-center gap-1">
        <Link
          href={partia ? "/plany/atlas" : "/plany"}
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

      {!partia && query.trim().length < 2 ? (
        <div className="mt-4 space-y-4">
          {FAMILIES.map((fam) => (
            <section key={fam.title}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
                {fam.title} · {fam.ids.length} partii
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {fam.ids.map((id) => {
                  const cat = MUSCLE_CATEGORIES.find((c) => c.id === id);
                  if (!cat) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      className="app-card flex min-h-[84px] items-center gap-2.5 p-3 text-left"
                      onClick={() => setPartia(id)}
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
        <div className="mt-4">
          <p className="mb-2 text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
            Znaleziono {results.length}
            {results.length >= 40 ? "+" : ""}
          </p>
          {results.length === 0 ? (
            <div className="app-card border border-white/10 p-4">
              <p className="font-semibold text-white">
                {query.trim().length >= 2
                  ? `Brak wyników dla „${query.trim()}”`
                  : "Brak ćwiczeń dla tych filtrów."}
              </p>
            </div>
          ) : (
            <ul>
              {results.map((ex) => (
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
                      {ex.aliasesEn?.[0] ??
                        MUSCLE_CATEGORIES.find((c) => c.id === ex.categoryId)
                          ?.label}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/plany/nowy"
            className={cn(
              "mt-4 inline-flex h-12 w-full items-center justify-center rounded-2xl border border-[var(--gym-border-gold)] text-[14px] font-semibold text-white",
            )}
          >
            Dodaj do planu (nowy plan)
          </Link>
        </div>
      )}
    </div>
  );
}
