"use client";

import dynamic from "next/dynamic";
import type {
  ExerciseLeaderboardRow,
  PeriodCompare,
  RelativeStrengthPoint,
  RirBucket,
  RirPoint,
  SetsPoint,
  StrengthPoint,
  VolumePoint,
  WeightPoint,
} from "@/lib/progress-analysis";

function ProgressChartsLoadingSkeleton() {
  return (
    <div className="grid gap-2.5 lg:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="app-card h-[300px] animate-pulse" />
      ))}
    </div>
  );
}

const ProgressCharts = dynamic(
  () =>
    import("@/components/progress-analysis/progress-charts").then(
      (m) => m.ProgressCharts,
    ),
  {
    ssr: false,
    loading: ProgressChartsLoadingSkeleton,
  },
);

export function ProgressChartsDynamic(props: {
  weights: WeightPoint[];
  volume: VolumePoint[];
  strength: StrengthPoint[];
  relativeStrength: RelativeStrengthPoint[];
  avgRir: RirPoint[];
  sets: SetsPoint[];
  exerciseLeaderboard: ExerciseLeaderboardRow[];
  topByE1rm: ExerciseLeaderboardRow[];
  rirDistribution: RirBucket[];
  periodCompare: PeriodCompare;
}) {
  return <ProgressCharts {...props} />;
}
