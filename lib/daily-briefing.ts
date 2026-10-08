import "server-only";

import {
  buildCoachRecentContext,
  type CoachBriefingContext,
} from "@/lib/coach-context";
import { getBriefingTimeContext } from "@/lib/briefing-time-context";
import { buildHeuristicBriefText } from "@/lib/briefing-heuristic";

export type DailyBriefingSource = "heuristic";

export type DailyBriefing = {
  text: string;
  source: DailyBriefingSource;
  /** Zawsze false — brak wbudowanego modelu LLM. */
  aiEntitled: false;
};

/** Dane już wczytane na stronie Start — bez powtórnych zapytań do DB przed briefingiem. */
export type DailyBriefingPrefetch = {
  recentContext: NonNullable<CoachBriefingContext["recentContext"]>;
  userProfile?: CoachBriefingContext["userProfile"];
  userAiOff?: boolean;
};

/** Krótki briefing na Start — wyłącznie z danych aplikacji (bez LLM). */
export async function getDailyBriefing(
  userId: string,
  prefetch?: DailyBriefingPrefetch,
): Promise<DailyBriefing> {
  const timeCtx = getBriefingTimeContext();
  const rc =
    prefetch?.recentContext ?? (await buildCoachRecentContext(userId));

  return {
    text: buildHeuristicBriefText(rc, timeCtx),
    source: "heuristic",
    aiEntitled: false,
  };
}
