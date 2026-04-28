"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Apple,
  ChevronDown,
  Dumbbell,
  HeartPulse,
  PieChart,
  TrendingDown,
  X,
  UtensilsCrossed,
} from "lucide-react";
import { releaseDocumentScrollLock } from "@/lib/document-scroll";
import { cn } from "@/lib/utils";

export type HomeStartSectionId =
  | "macros"
  | "meals"
  | "targets"
  | "weekly-deficit"
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
  subtitleWeeklyDeficit,
  subtitleCheckIn,
  subtitleLastWorkout,
  subtitleTrend,
  showTrend,
  macrosPanel,
  mealsPanel,
  targetsPanel,
  weeklyDeficitPanel,
  checkInPanel,
  lastWorkoutPanel,
  trendPanel,
}: {
  subtitleMacros: string;
  subtitleMeals: string;
  subtitleTargets: string;
  subtitleWeeklyDeficit: string;
  subtitleCheckIn: string;
  subtitleLastWorkout: string;
  subtitleTrend: string;
  showTrend: boolean;
  macrosPanel: ReactNode;
  mealsPanel: ReactNode;
  targetsPanel: ReactNode;
  weeklyDeficitPanel: ReactNode;
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
        id: "weekly-deficit",
        title: "Deficyt tygodnia",
        subtitle: subtitleWeeklyDeficit,
        icon: TrendingDown,
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
      subtitleWeeklyDeficit,
      subtitleCheckIn,
      subtitleTrend,
    ],
  );

  const [open, setOpen] = useState<HomeStartSectionId | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function closePanel() {
    setOpen(null);
    queueMicrotask(() => releaseDocumentScrollLock());
  }

  const panel =
    open === "macros"
      ? macrosPanel
      : open === "meals"
        ? mealsPanel
        : open === "targets"
          ? targetsPanel
          : open === "weekly-deficit"
            ? weeklyDeficitPanel
          : open === "check-in"
            ? checkInPanel
            : open === "last-workout"
              ? lastWorkoutPanel
              : open === "trend" && showTrend
                ? trendPanel
                : null;

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const root = document.documentElement;
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closePanel();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      releaseDocumentScrollLock();
    };
  }, [open]);

  const modal =
    mounted &&
    open &&
    panel &&
    createPortal(
      <div
        className="fixed inset-0 z-[100] flex flex-col justify-end md:items-center md:justify-center md:p-4"
        role="presentation"
      >
        <button
          type="button"
          aria-label="Zamknij panel"
          className="absolute inset-0 z-0 bg-black/80 backdrop-blur-[3px]"
          onClick={closePanel}
        />

        <div
          className={cn(
            "relative z-[1] flex max-h-[min(92dvh,920px)] w-full flex-col overflow-hidden rounded-t-[1.35rem] border border-white/15 bg-[#07070c] shadow-[0_-12px_60px_rgba(0,0,0,0.85)] md:max-h-[min(85vh,820px)] md:w-[min(560px,94vw)] md:rounded-2xl md:shadow-[0_24px_80px_rgba(0,0,0,0.75)]",
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby="home-start-panel-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.08] px-4 pb-3 pt-4 sm:px-5">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/55">
                Szczegóły
              </p>
              <p
                id="home-start-panel-title"
                className="font-heading mt-1 text-lg font-semibold text-white"
              >
                {tiles.find((t) => t.id === open)?.title ?? "Panel"}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-white/75 transition hover:bg-white/[0.10] focus-visible:ring-2 focus-visible:ring-[var(--neon)]/45"
              onClick={closePanel}
              aria-label="Zamknij"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          {/* Jedno miejsce przewijania — ważne na iOS (touch wewnątrz modala) */}
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 [-webkit-overflow-scrolling:touch] touch-pan-y sm:px-5 sm:pb-6"
          >
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(900px_420px_at_15%_0%,rgba(255,45,85,0.12),transparent_60%)]" />
              <div className="relative">{panel}</div>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <section className="relative space-y-4">
      <div className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          const isOpen = open === tile.id;
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => (isOpen ? closePanel() : setOpen(tile.id))}
              aria-expanded={isOpen}
              aria-haspopup="dialog"
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
      {modal}
    </section>
  );
}
