import "server-only";

import { chatCoach } from "@/ai/coach";
import { isAiConfigured } from "@/ai/client";
import { buildCoachRecentContext, buildCoachUserProfile } from "@/lib/coach-context";

export type DailyBriefingSource = "ai" | "heuristic";

export type DailyBriefing = {
  text: string;
  source: DailyBriefingSource;
};

function heuristicBrief(rc: Awaited<ReturnType<typeof buildCoachRecentContext>>): string {
  return [
    `Dziś: ${rc.nutritionSummary}.`,
    rc.trainingSummary,
    `Nawyki: ${rc.streakLine}.`,
    "Utrzymaj rytuał — krótki trening pokonuje zerowy.",
  ].join(" ");
}

const briefingUserPrompt = `Jesteś Trenerem AI GymBrat. To moduł „Briefing dnia” na stronie głównej — użytkownik widzi tylko Twój tekst (bez czatu).

Napisz briefing po polsku: 2–4 krótkie zdania. Wpleć przynajmniej jedną konkretną obserwację opartą wyłącznie na danych z kontekstu aplikacji (makra, trening, pasma). Dodaj jedną praktyczną wskazówkę na dziś.
Bez powitania typu „cześć” / „witaj”, bez podpisu, bez pytań na końcu.`;

/** Krótki briefing na Start (Ten sam model co Coach czat — lub heurystyka bez klucza API). */
export async function getDailyBriefing(userId: string): Promise<DailyBriefing> {
  const [rc, profile] = await Promise.all([
    buildCoachRecentContext(userId),
    buildCoachUserProfile(userId),
  ]);

  if (!isAiConfigured()) {
    return { text: heuristicBrief(rc), source: "heuristic" };
  }

  try {
    const text = await chatCoach({
      messages: [{ role: "user", content: briefingUserPrompt }],
      context: {
        userProfile: profile,
        recentContext: rc,
        guardrails: { tone: "supportive" },
        task: "daily_briefing",
      },
    });
    const t = text.trim();
    if (t.length > 20) return { text: t, source: "ai" };
  } catch {
    /* fall through */
  }

  return { text: heuristicBrief(rc), source: "heuristic" };
}
