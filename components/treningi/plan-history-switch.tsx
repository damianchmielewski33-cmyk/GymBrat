"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { HomeRecentWorkouts } from "@/components/home/home-recent-workouts";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { RecentWorkoutItem } from "@/lib/treningi-hub-stats";

type View = "plan" | "history";

/** Przełącznik Plan / Historia (makieta Trening): panel planu lub ostatnie treningi. */
export function PlanHistorySwitch({
  plan,
  recentWorkouts,
}: {
  plan: ReactNode;
  recentWorkouts: RecentWorkoutItem[];
}) {
  const [view, setView] = useState<View>("plan");
  return (
    <div className="space-y-3">
      <SegmentedControl
        ariaLabel="Widok treningu"
        value={view}
        onChange={setView}
        options={[
          { value: "plan", label: "Plan" },
          { value: "history", label: "Historia" },
        ]}
      />
      {view === "plan" ? (
        plan
      ) : (
        <div className="space-y-3">
          <HomeRecentWorkouts workouts={recentWorkouts} />
          <Link
            href="/workout-history"
            className="gym-tap flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/20 text-[15px] font-semibold text-white"
          >
            Cała historia treningów
          </Link>
        </div>
      )}
    </div>
  );
}
