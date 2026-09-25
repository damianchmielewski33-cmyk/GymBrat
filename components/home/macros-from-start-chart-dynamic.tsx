"use client";

import dynamic from "next/dynamic";
import type { HomeStartMacroPoint } from "@/lib/home-start";

const MacrosFromStartChart = dynamic(
  () =>
    import("@/components/home/macros-from-start-chart").then(
      (m) => m.MacrosFromStartChart,
    ),
  {
    ssr: false,
    loading: () => (
      <section className="app-card flex h-[300px] items-center justify-center p-5">
        <p className="text-xs text-white/40">Ładowanie wykresu makro…</p>
      </section>
    ),
  },
);

export function MacrosFromStartChartDynamic({
  data,
  weightFromStartKg,
}: {
  data: HomeStartMacroPoint[];
  weightFromStartKg?: number | null;
}) {
  return (
    <MacrosFromStartChart data={data} weightFromStartKg={weightFromStartKg} />
  );
}
