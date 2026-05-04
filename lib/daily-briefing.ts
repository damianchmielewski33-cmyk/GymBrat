import "server-only";

import type { ChatCoachPromptInput } from "@/ai/prompts/chatCoach";
import { chatCoach } from "@/ai/coach";
import { isAiConfigured } from "@/ai/client";
import { buildCoachRecentContext, buildCoachUserProfile } from "@/lib/coach-context";
import { getUserAiEntitled, getUserAiFeaturesDisabled } from "@/lib/user-ai-preference";
import { getBriefingTimeContext } from "@/lib/briefing-time-context";
import { buildHeuristicBriefText } from "@/lib/briefing-heuristic";
import { isAiGloballyDisabled } from "@/lib/ai-availability";

export type DailyBriefingSource = "ai" | "heuristic" | "web";

export type DailyBriefing = {
  text: string;
  source: DailyBriefingSource;
  /** Nadanie funkcji AI przez administratora — przy false nie pokazujemy brandingu „Trener AI”. */
  aiEntitled: boolean;
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

function briefingUserPromptBody(timeLine: string): string {
  return `Jesteś Trenerem AI GymBrat. To moduł „Briefing dnia” na stronie głównej — użytkownik widzi tylko Twój tekst (bez czatu).

${timeLine}

Napisz briefing po polsku: 2–4 krótkie zdania. Ma być praktyczny i oparty o dane z aplikacji (kalorie, makro, posiłki, trening, trend, pasma). Dopasuj treść do pory dnia (nie mów o „początku dnia” ani porannej rozgrzewce, jeśli jest późny wieczór/noc). Wpleć przynajmniej jedną konkretną obserwację z liczb (wyłącznie z kontekstu). Dodaj 1 wskazówkę na **teraz** / najbliższe godziny (żywienie albo trening albo regeneracja) — bez wymyślania liczb spoza kontekstu.
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

  const [globalOff, entitled] = await Promise.all([
    isAiGloballyDisabled(),
    getUserAiEntitled(userId),
  ]);
  if (!isAiConfigured() || userAiOff || globalOff) {
    return {
      text: buildHeuristicBriefText(rc, timeCtx),
      source: "heuristic",
      aiEntitled: entitled,
      aiDisabledByUser: userAiOff,
    };
  }
  if (!entitled) {
    return {
      text: buildHeuristicBriefText(rc, timeCtx),
      source: "heuristic",
      aiEntitled: false,
    };
  }

  try {
    const reply = await chatCoach({
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
    const t = reply.text.trim();
    if (reply.source === "web" && t.length > 40) {
      return { text: t, source: "web", aiEntitled: true };
    }
    if (t.length > 20) return { text: t, source: "ai", aiEntitled: true };
  } catch {
    /* fall through — integracja z modelem nie powiodła się */
  }

  return {
    text: buildHeuristicBriefText(rc, timeCtx) + AI_UNAVAILABLE_SUFFIX,
    source: "heuristic",
    aiEntitled: true,
    aiUnavailable: true,
  };
}
