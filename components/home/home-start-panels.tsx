"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Apple,
  ChevronDown,
  Dumbbell,
  HeartPulse,
  PieChart,
  X,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type HomeStartSectionId =
  | "macros"
  | "meals"
  | "targets"
  | "check-in"
  | "last-workout"
  | "trend";

type TileDef = {
  id: HomeStartSectionId;
  title: string;
  subtitle: string;
  icon: typeof Apple;
};

export function HomeStartPanels({
  subtitleMacros,
  subtitleMeals,
  subtitleTargets,
  subtitleCheckIn,
  subtitleLastWorkout,
  subtitleTrend,
  showTrend,
  macrosPanel,
  mealsPanel,
  targetsPanel,
  checkInPanel,
  lastWorkoutPanel,
  trendPanel,
}: {
  subtitleMacros: string;
  subtitleMeals: string;
  subtitleTargets: string;
  subtitleCheckIn: string;
  subtitleLastWorkout: string;
  subtitleTrend: string;
  showTrend: boolean;
  macrosPanel: ReactNode;
  mealsPanel: ReactNode;
  targetsPanel: ReactNode;
  checkInPanel: ReactNode;
  lastWorkoutPanel: ReactNode;
  trendPanel: ReactNode;
}) {
  const tiles: TileDef[] = useMemo(
    () => [
      {
        id: "macros",
        title: "Wartości odżywcze na dziś",
        subtitle: subtitleMacros,
        icon: Apple,
      },
      {
        id: "meals",
        title: "Twoje posiłki",
        subtitle: subtitleMeals,
        icon: UtensilsCrossed,
      },
      {
        id: "targets",
        title: "Realizacja celów",
        subtitle: subtitleTargets,
        icon: PieChart,
      },
      {
        id: "check-in",
        title: "Check-in dnia",
        subtitle: subtitleCheckIn,
        icon: HeartPulse,
      },
      {
        id: "last-workout",
        title: "Ostatni trening",
        subtitle: subtitleLastWorkout,
        icon: Dumbbell,
      },
      ...(showTrend
        ? [
            {
              id: "trend" as const,
              title: "Trend treningów",
              subtitle: subtitleTrend,
              icon: Activity,
            },
          ]
        : []),
    ],
    [
      showTrend,
      subtitleLastWorkout,
      subtitleMacros,
      subtitleMeals,
      subtitleTargets,
      subtitleCheckIn,
      subtitleTrend,
    ],
  );

  const [open, setOpen] = useState<HomeStartSectionId | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const tileRefs = useRef<Record<HomeStartSectionId, HTMLButtonElement | null>>(
    {} as Record<HomeStartSectionId, HTMLButtonElement | null>,
  );
  const [anchor, setAnchor] = useState<{
    top: number;
    left: number;
    width: number;
    minHeight: number;
  } | null>(null);

  function measureAnchor(id: HomeStartSectionId) {
    const grid = gridRef.current;
    const btn = tileRefs.current[id];
    if (!grid || !btn) return null;
    const g = grid.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    return {
      top: b.top - g.top,
      left: b.left - g.left,
      width: b.width,
      minHeight: b.height,
    };
  }

  function openPanel(id: HomeStartSectionId) {
    setOpen(id);
    setAnchor(measureAnchor(id));
  }

  function closePanel() {
    setOpen(null);
    setAnchor(null);
  }

  const panel =
    open === "macros"
      ? macrosPanel
      : open === "meals"
        ? mealsPanel
        : open === "targets"
          ? targetsPanel
          : open === "check-in"
            ? checkInPanel
          : open === "last-workout"
            ? lastWorkoutPanel
            : open === "trend" && showTrend
              ? trendPanel
              : null;

  useEffect(() => {
    if (!open) return;
    function recalc() {
      // `open` is narrowed by the guard above.
      setAnchor(measureAnchor(open as HomeStartSectionId));
    }
    recalc();
    window.addEventListener("resize", recalc);
    // Capture scroll from nested containers too.
    window.addEventListener("scroll", recalc, true);
    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [open]);

  return (
    <section className="relative space-y-4">
      <div
        ref={gridRef}
        className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {tiles.map((tile) => {
          const Icon = tile.icon;
          const isOpen = open === tile.id;
          return (
            <button
              key={tile.id}
              type="button"
              ref={(el) => {
                tileRefs.current[tile.id] = el;
              }}
              onClick={() => (isOpen ? closePanel() : openPanel(tile.id))}
              aria-expanded={isOpen}
              className={cn(
                "flex w-full flex-col gap-2 rounded-2xl border p-4 text-left transition-colors duration-150",
                isOpen
                  ? "border-[var(--neon)]/45 bg-white/[0.07] shadow-[0_0_24px_rgba(230,0,35,0.12)]"
                  : "border-white/10 bg-white/[0.03] hover:border-white/18 hover:bg-white/[0.055]",
              )}
              style={
                isOpen
                  ? {
                      boxShadow:
                        "0 0 0 1px rgba(230,0,35,0.22), 0 8px 28px rgba(0,0,0,0.45)",
                    }
                  : undefined
              }
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                      isOpen
                        ? "border-[var(--neon)]/40 bg-[var(--neon)]/15 text-[var(--neon)]"
                        : "border-white/12 bg-white/[0.05] text-white/55",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="font-heading block text-[15px] font-semibold leading-snug text-white">
                      {tile.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-white/45">
                      {tile.subtitle}
                    </span>
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-white/35 transition-transform duration-200",
                    isOpen ? "rotate-180 text-[var(--neon)]" : "",
                  )}
                  aria-hidden
                />
              </div>
            </button>
          );
        })}

        {panel && anchor ? (
          <div
            className="absolute z-30 rounded-2xl border border-white/10 bg-black/55 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            onClick={closePanel}
            style={{
              top: anchor.top,
              left: anchor.left,
              width: anchor.width,
              minHeight: anchor.minHeight,
            }}
          >
            <div
              className="absolute inset-x-0 top-0 max-h-[min(80vh,780px)] overflow-y-auto p-2 sm:p-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="glass-panel neon-glow relative overflow-hidden p-4 sm:p-5">
                <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(900px_420px_at_15%_0%,rgba(255,45,85,0.10),transparent_60%)]" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/55">
                      Szczegóły
                    </p>
                    <p className="font-heading mt-1 text-lg font-semibold text-white">
                      {tiles.find((t) => t.id === open)?.title ?? "Panel"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/[0.05] text-white/70 transition hover:bg-white/[0.09] focus-visible:ring-2 focus-visible:ring-[var(--neon)]/45"
                    onClick={closePanel}
                    aria-label="Zamknij"
                  >
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                </div>

                <div className="relative mt-4">{panel}</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
