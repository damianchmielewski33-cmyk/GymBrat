"use client";

import dynamic from "next/dynamic";
import type { HomeStartWaistPoint, HomeStartWeightPoint } from "@/lib/home-start";

const WeightRangeChart = dynamic(
  () =>
    import("@/components/home/weight-range-chart").then((m) => m.WeightRangeChart),
  {
    ssr: false,
    loading: () => <div className="app-card h-[280px] animate-pulse" />,
  },
);

export function WeightRangeChartDynamic({
  data,
  waist,
}: {
  data: HomeStartWeightPoint[];
  waist?: HomeStartWaistPoint[];
}) {
  return <WeightRangeChart data={data} waist={waist} />;
}
