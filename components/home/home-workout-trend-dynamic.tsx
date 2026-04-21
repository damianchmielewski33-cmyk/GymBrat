"use client";

import dynamic from "next/dynamic";
import type { WorkoutTrendPoint } from "@/lib/home-stats";

const WorkoutTrendChart = dynamic(
  () =>
    import("@/components/home/workout-trend-chart").then(
      (m) => m.WorkoutTrendChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[220px] w-full animate-pulse rounded-2xl bg-white/5 sm:h-[280px]" />
    ),
  },
);

export function HomeWorkoutTrendDynamic({ data }: { data: WorkoutTrendPoint[] }) {
  return <WorkoutTrendChart data={data} />;
}
