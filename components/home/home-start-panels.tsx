"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  Activity,
  Apple,
  ChevronDown,
  Dumbbell,
  PieChart,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type HomeStartSectionId =
  | "macros"
  | "meals"
  | "targets"
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
  subtitleLastWorkout,
  subtitleTrend,
  showTrend,
  macrosPanel,
  mealsPanel,
  targetsPanel,
  lastWorkoutPanel,
  trendPanel,
}: {
  subtitleMacros: string;
  subtitleMeals: string;
  subtitleTargets: string;
  subtitleLastWorkout: string;
  subtitleTrend: string;
  showTrend: boolean;
  macrosPanel: ReactNode;
  mealsPanel: ReactNode;
  targetsPanel: ReactNode;
  lastWorkoutPanel: ReactNode;
  trendPanel: ReactNode;
}) {
  const tiles: TileDef[] = [
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
  ];

  const [open, setOpen] = useState<HomeStartSectionId | null>(null);

  function toggle(id: HomeStartSectionId) {
    setOpen((prev) => (prev === id ? null : id));
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          const isOpen = open === tile.id;
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => toggle(tile.id)}
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
      </div>

      <div className="min-h-0">
        {open === "macros" ? (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            {macrosPanel}
          </div>
        ) : null}
        {open === "meals" ? (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            {mealsPanel}
          </div>
        ) : null}
        {open === "targets" ? (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            {targetsPanel}
          </div>
        ) : null}
        {open === "last-workout" ? (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            {lastWorkoutPanel}
          </div>
        ) : null}
        {open === "trend" && showTrend ? (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            {trendPanel}
          </div>
        ) : null}
      </div>
    </section>
  );
}
