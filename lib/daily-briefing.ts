import "server-only";

import { chatCoach } from "@/ai/coach";
import { isAiConfigured } from "@/ai/client";
import { buildCoachRecentContext, buildCoachUserProfile } from "@/lib/coach-context";

function heuristicBrief(rc: Awaited<ReturnType<typeof buildCoachRecentContext>>): string {
  return [
    `Dziś: ${rc.nutritionSummary}.`,
    rc.trainingSummary,
    `Nawyki: ${rc.streakLine}.`,
    "Utrzymaj rytuał — krótki trening pokonuje zerowy.",
  ].join(" ");
}

/** Krótki briefing na Start (AI lub heurystyka bez klucza). */
export async function getDailyBriefingText(userId: string): Promise<string> {
  const [rc, profile] = await Promise.all([
    buildCoachRecentContext(userId),
    buildCoachUserProfile(userId),
  ]);

  if (!isAiConfigured()) {
    return heuristicBrief(rc);
  }

  try {
    const text = await chatCoach({
      messages: [
        {
          role: "user",
          content:
            "Napisz po polsku 2–3 zdania: dzienny briefing dla zawodnika (motywacja + jedna konkretna sugestia na dziś). Bez powitania „cześć”.",
        },
      ],
      context: {
        userProfile: profile,
        recentContext: rc,
        guardrails: { tone: "supportive" },
      },
    });
    const t = text.trim();
    if (t.length > 20) return t;
  } catch {
    /* fall through */
  }

  return heuristicBrief(rc);
}
