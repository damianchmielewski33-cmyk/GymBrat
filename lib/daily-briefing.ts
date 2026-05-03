import "server-only";

import type { ChatCoachPromptInput } from "@/ai/prompts/chatCoach";
import { chatCoach } from "@/ai/coach";
import { isAiConfigured } from "@/ai/client";
import { buildCoachRecentContext, buildCoachUserProfile } from "@/lib/coach-context";
import { getUserAiFeaturesDisabled } from "@/lib/user-ai-preference";
import { getBriefingTimeContext } from "@/lib/briefing-time-context";

export type DailyBriefingSource = "ai" | "heuristic";

export type DailyBriefing = {
  text: string;
  source: DailyBriefingSource;
  /** Użytkownik wyłączył AI w profilu (tekst z heurystyki). */
  aiDisabledByUser?: boolean;
  /** Próba wywołania modelu (Trener AI) nie powiodła się — treść z heurystyki + dopisek w tekście. */
  aiUnavailable?: boolean;
};

/** Dane już wczytane na stronie Start — bez powtórnych zapytań do DB przed briefingiem. */
export type DailyBriefingPrefetch = {
  recentContext: NonNullable<ChatCoachPromptInput["recentContext"]>;
  userProfile: ChatCoachPromptInput["userProfile"];
  userAiOff: boolean;
};

function heuristicBrief(
  rc: Awaited<ReturnType<typeof buildCoachRecentContext>>,
  time: ReturnType<typeof getBriefingTimeContext>,
): string {
  const late = time.hour >= 22 || time.hour < 5;
  const tail = late
    ? "Wieczorem skup się na regeneracji i spokojnym domknięciu makro — jutro zaczniesz na świeżo."
    : "Utrzymaj rytuał — krótki trening pokonuje zerowy.";
  return [
    time.linePl,
    `Dziś: ${rc.nutritionSummary}.`,
    rc.trainingSummary,
    `Nawyki: ${rc.streakLine}.`,
    tail,
  ].join(" ");
}

function briefingUserPromptBody(timeLine: string): string {
  return `Jesteś Trenerem AI GymBrat. To moduł „Briefing dnia” na stronie głównej — użytkownik widzi tylko Twój tekst (bez czatu).

${timeLine}

Napisz briefing po polsku: 2–4 krótkie zdania. Dopasuj treść do pory dnia (nie mów o „początku dnia” ani porannej rozgrzewce, jeśli jest późny wieczór/noc). Wpleć przynajmniej jedną konkretną obserwację opartą wyłącznie na danych z kontekstu aplikacji (makra, trening, pasma). Jedna realistyczna wskazówka na **teraz** lub na najbliższe godziny — bez wymyślania liczb spoza kontekstu.
Bez powitania typu „cześć” / „witaj”, bez podpisu, bez pytań na końcu.`;
}

const AI_UNAVAILABLE_SUFFIX = "\n\nAI niedostępny.";

/** Krótki briefing na Start (Ten sam model co Coach czat — lub heurystyka bez klucza API). */
export async function getDailyBriefing(
  userId: string,
  prefetch?: DailyBriefingPrefetch,
): Promise<DailyBriefing> {
  const timeCtx = getBriefingTimeContext();

  let userAiOff: boolean;
  let rc: NonNullable<ChatCoachPromptInput["recentContext"]>;
  let profile: ChatCoachPromptInput["userProfile"];

  if (prefetch) {
    userAiOff = prefetch.userAiOff;
    rc = prefetch.recentContext;
    profile = prefetch.userProfile;
  } else {
    [userAiOff, rc, profile] = await Promise.all([
      getUserAiFeaturesDisabled(userId),
      buildCoachRecentContext(userId),
      buildCoachUserProfile(userId),
    ]);
  }

  if (!isAiConfigured() || userAiOff) {
    return {
      text: heuristicBrief(rc, timeCtx),
      source: "heuristic",
      aiDisabledByUser: userAiOff,
    };
  }

  try {
    const text = await chatCoach({
      messages: [{ role: "user", content: briefingUserPromptBody(timeCtx.linePl) }],
      context: {
        userProfile: profile,
        recentContext: {
          ...rc,
          briefingLocalTime: timeCtx.linePl,
        },
        guardrails: { tone: "supportive" },
        task: "daily_briefing",
      },
    });
    const t = text.trim();
    if (t.length > 20) return { text: t, source: "ai" };
  } catch {
    /* fall through — integracja z modelem nie powiodła się */
  }

  return {
    text: heuristicBrief(rc, timeCtx) + AI_UNAVAILABLE_SUFFIX,
    source: "heuristic",
    aiUnavailable: true,
  };
}
