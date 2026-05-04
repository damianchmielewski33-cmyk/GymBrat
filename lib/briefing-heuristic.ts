import type { BriefingTimeContext } from "@/lib/briefing-time-context";

/** Minimalny kontekst z `buildCoachRecentContext` — czysta funkcja do testów i fallbaców. */
export type HeuristicRecentContext = {
  nutritionSummary?: string | null;
  nutritionMacrosLine?: string | null;
  nutritionMealsLine?: string | null;
  trainingSummary?: string | null;
  trainingTrendLine?: string | null;
  progressSummary?: string | null;
  streakLine?: string | null;
};

export function buildHeuristicBriefText(
  rc: HeuristicRecentContext,
  time: Pick<BriefingTimeContext, "linePl" | "hour">,
): string {
  const late = time.hour >= 22 || time.hour < 5;
  const morning = time.hour >= 5 && time.hour < 10;

  const calories = rc.nutritionSummary ? `Kalorie: ${rc.nutritionSummary}.` : "";
  const macros = rc.nutritionMacrosLine ? `Makro: ${rc.nutritionMacrosLine}.` : "";
  const meals = rc.nutritionMealsLine ? `${rc.nutritionMealsLine}.` : "";

  const training = rc.trainingSummary ? `Trening: ${rc.trainingSummary}.` : "";
  const deltas = [rc.trainingTrendLine, rc.progressSummary].filter(Boolean).join(" · ");
  const trend = deltas ? `Sygnał: ${deltas}.` : "";

  const streaks = rc.streakLine ? `Nawyki: ${rc.streakLine}.` : "";

  const cue = late
    ? "Na teraz: domknij dzień spokojnie — lekki posiłek pod cele, woda i priorytet na sen."
    : morning
      ? "Na teraz: ustaw plan na 3 najważniejsze rzeczy — białko w 1. posiłku, woda i konkretny slot na trening/spacer."
      : "Na teraz: wybierz 1 ruch, który dowozi wynik — dopnij białko w kolejnym posiłku albo zrób 20–30 min aktywności, jeśli dziś jeszcze nie było.";

  const s1 = [calories, macros, meals].filter(Boolean).join(" ");
  const s2 = [training, trend].filter(Boolean).join(" ");
  const s3 = streaks;

  const sentences = [s1, s2, s3, cue].filter(Boolean).slice(0, 4);
  return [time.linePl, ...sentences].join("\n").trim();
}
