"use client";

import dynamic from "next/dynamic";
import type { RelativeStrengthPoint, StrengthPoint, VolumePoint, WeightPoint } from "@/lib/progress-analysis";

function ProgressChartsLoadingSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="glass-panel neon-glow h-[360px] animate-pulse" />
      <div className="glass-panel neon-glow h-[360px] animate-pulse" />
      <div className="glass-panel neon-glow h-[360px] animate-pulse lg:col-span-2" />
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

export function ProgressChartsDynamic({
  weights,
  volume,
  strength,
  relativeStrength,
}: {
  weights: WeightPoint[];
  volume: VolumePoint[];
  strength: StrengthPoint[];
  relativeStrength: RelativeStrengthPoint[];
}) {
  return (
    <ProgressCharts
      weights={weights}
      volume={volume}
      strength={strength}
      relativeStrength={relativeStrength}
    />
  );
}
