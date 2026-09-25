"use client";

import { WeightRangeChart } from "@/components/home/weight-range-chart";
import type { HomeStartWaistPoint, HomeStartWeightPoint } from "@/lib/home-start";

export function WeightRangeChartDynamic({
  data,
  waist,
}: {
  data: HomeStartWeightPoint[];
  waist?: HomeStartWaistPoint[];
}) {
  return <WeightRangeChart data={data} waist={waist} />;
}
