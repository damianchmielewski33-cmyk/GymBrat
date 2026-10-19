export type WeekCompareTrend = "up" | "flat" | "down" | "none";

export type WeekCompareOutcome = "progress" | "regress" | "flat" | "none";

export type WeekMetricCompare = {
  key: "workouts" | "tonnageKg" | "cardioMinutes" | "avgRpe" | "avgRir";
  label: string;
  unit: string;
  current: number | null;
  previous: number | null;
  deltaAbs: number | null;
  deltaPct: number | null;
  trend: WeekCompareTrend;
  higherIsBetter: boolean;
  outcome: WeekCompareOutcome;
};

export type WeekTrainingCompare = {
  /** Pn–dziś (bieżący tydzień). */
  thisRangeLabel: string;
  /** Ten sam zakres w poprzednim tygodniu. */
  prevRangeLabel: string;
  metrics: WeekMetricCompare[];
  /** Podsumowanie: większość metryk w górę / w dół. */
  verdict: "progress" | "regress" | "flat" | "insufficient";
  verdictLabel: string;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function trendOf(prev: number, next: number): WeekCompareTrend {
  if (prev <= 0 && next <= 0) return "flat";
  if (prev <= 0) return next > 0 ? "up" : "flat";
  const pct = ((next - prev) / prev) * 100;
  if (pct >= 3) return "up";
  if (pct <= -3) return "down";
  return "flat";
}

function outcomeFromTrend(
  trend: WeekCompareTrend,
  higherIsBetter: boolean,
): WeekCompareOutcome {
  if (trend === "none" || trend === "flat") {
    return trend === "flat" ? "flat" : "none";
  }
  if (higherIsBetter) return trend === "up" ? "progress" : "regress";
  // Niższy RIR = ciężej (często pożądane w progresji)
  return trend === "down" ? "progress" : "regress";
}

export function buildWeekMetricCompare(input: {
  key: WeekMetricCompare["key"];
  label: string;
  unit: string;
  current: number | null;
  previous: number | null;
  higherIsBetter: boolean;
}): WeekMetricCompare {
  const { key, label, unit, current, previous, higherIsBetter } = input;
  if (current == null || previous == null) {
    return {
      key,
      label,
      unit,
      current,
      previous,
      deltaAbs: null,
      deltaPct: null,
      trend: "none",
      higherIsBetter,
      outcome: "none",
    };
  }
  const deltaAbs = round1(current - previous);
  const deltaPct =
    previous === 0
      ? current === 0
        ? 0
        : null
      : round1(((current - previous) / Math.abs(previous)) * 100);
  const trend = trendOf(previous, current);
  return {
    key,
    label,
    unit,
    current,
    previous,
    deltaAbs,
    deltaPct,
    trend,
    higherIsBetter,
    outcome: outcomeFromTrend(trend, higherIsBetter),
  };
}

export function buildWeekTrainingCompare(input: {
  thisRangeLabel: string;
  prevRangeLabel: string;
  workouts: { current: number; previous: number };
  tonnageKg: { current: number; previous: number };
  cardioMinutes: { current: number; previous: number };
  avgRpe: { current: number | null; previous: number | null };
  avgRir: { current: number | null; previous: number | null };
}): WeekTrainingCompare {
  const metrics: WeekMetricCompare[] = [
    buildWeekMetricCompare({
      key: "workouts",
      label: "Treningi",
      unit: "",
      current: input.workouts.current,
      previous: input.workouts.previous,
      higherIsBetter: true,
    }),
    buildWeekMetricCompare({
      key: "tonnageKg",
      label: "Tonaż",
      unit: "t",
      current: round1(input.tonnageKg.current / 1000),
      previous: round1(input.tonnageKg.previous / 1000),
      higherIsBetter: true,
    }),
    buildWeekMetricCompare({
      key: "cardioMinutes",
      label: "Cardio",
      unit: "min",
      current: input.cardioMinutes.current,
      previous: input.cardioMinutes.previous,
      higherIsBetter: true,
    }),
    buildWeekMetricCompare({
      key: "avgRpe",
      label: "Śr. RPE",
      unit: "",
      current: input.avgRpe.current,
      previous: input.avgRpe.previous,
      // Wyższe RPE = ciężej — liczymy jako progres obciążenia
      higherIsBetter: true,
    }),
    buildWeekMetricCompare({
      key: "avgRir",
      label: "Śr. RIR",
      unit: "",
      current: input.avgRir.current,
      previous: input.avgRir.previous,
      // Niższy RIR = mniej zapasu = ciężej
      higherIsBetter: false,
    }),
  ];

  const scored = metrics.filter(
    (m) => m.outcome === "progress" || m.outcome === "regress",
  );
  if (scored.length === 0) {
    return {
      thisRangeLabel: input.thisRangeLabel,
      prevRangeLabel: input.prevRangeLabel,
      metrics,
      verdict: "insufficient",
      verdictLabel: "Za mało danych do porównania tygodni",
    };
  }
  const progress = scored.filter((m) => m.outcome === "progress").length;
  const regress = scored.filter((m) => m.outcome === "regress").length;
  let verdict: WeekTrainingCompare["verdict"] = "flat";
  let verdictLabel = "Tydzień do tygodnia bez wyraźnej zmiany";
  if (progress > regress) {
    verdict = "progress";
    verdictLabel = "Progres względem poprzedniego tygodnia";
  } else if (regress > progress) {
    verdict = "regress";
    verdictLabel = "Regres względem poprzedniego tygodnia";
  }

  return {
    thisRangeLabel: input.thisRangeLabel,
    prevRangeLabel: input.prevRangeLabel,
    metrics,
    verdict,
    verdictLabel,
  };
}

export function formatWeekCompareDelta(m: WeekMetricCompare): string {
  if (m.deltaPct != null) {
    const sign = m.deltaPct > 0 ? "+" : "";
    return `${sign}${m.deltaPct}%`;
  }
  if (m.deltaAbs != null) {
    const sign = m.deltaAbs > 0 ? "+" : "";
    return `${sign}${m.deltaAbs}${m.unit ? ` ${m.unit}` : ""}`;
  }
  return "—";
}
