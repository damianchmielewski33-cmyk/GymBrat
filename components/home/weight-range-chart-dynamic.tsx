"use client";

import dynamic from "next/dynamic";
import type { HomeStartWeightPoint } from "@/lib/home-start";

const WeightRangeChart = dynamic(
  () =>
    import("@/components/home/weight-range-chart").then((m) => m.WeightRangeChart),
  {
    ssr: false,
    loading: () => (
      <div className="glass-panel h-[320px] animate-pulse bg-white/[0.03]" />
    ),
  },
);

export function WeightRangeChartDynamic({
  data,
}: {
  data: HomeStartWeightPoint[];
}) {
  return <WeightRangeChart data={data} />;
}
