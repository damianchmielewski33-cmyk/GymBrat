"use server";

import { auth } from "@/auth";
import { chatCoach } from "@/ai/coach";
import { buildCoachRecentContext, buildCoachUserProfile } from "@/lib/coach-context";
import { UserMessages, mapCoachAiThrowable } from "@/lib/user-facing-errors";
import { getUserAiEntitled, getUserAiFeaturesDisabled } from "@/lib/user-ai-preference";
import { isAiEnabledForUser, isAiGloballyDisabled } from "@/lib/ai-availability";
import {
  buildCoachSearchQuery,
  fetchWebKnowledgeForCoachQuery,
  isWebSearchKnowledgeConfigured,
} from "@/lib/web-search-fallback";

/** Stan UI czatu (np. pływający przycisk) — bez wywołania modelu. */
export async function getCoachChatUiStatus(): Promise<{ mode: "hidden" | "ai" | "web" }> {
  const session = await auth();
  if (!session?.user?.id) return { mode: "hidden" };

  const userId = session.user.id;
  const [globalOff, entitled, userOff] = await Promise.all([
    isAiGloballyDisabled(),
    getUserAiEntitled(userId),
    getUserAiFeaturesDisabled(userId),
  ]);

  if (!entitled || userOff) return { mode: "hidden" };

  if (globalOff) return { mode: "web" };

  return { mode: (await isAiEnabledForUser(userId)) ? "ai" : "web" };
}

export async function coachChatAction(input: unknown): Promise<
  | { ok: true; reply: string; webFallback?: true }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: UserMessages.sessionExpired };

  const globalOff = await isAiGloballyDisabled();

  if (!(await getUserAiEntitled(session.user.id))) {
    return { ok: false, error: "Twoje konto nie ma aktywnych funkcji AI." };
  }

  if (await getUserAiFeaturesDisabled(session.user.id)) {
    return {
      ok: false,
      error:
        "Funkcje AI są wyłączone w profilu. Włącz je w sekcji „Funkcje AI”, aby ponownie korzystać z czatu z trenerem.",
    };
  }

  const raw = input as { messages?: unknown };
  const messages = raw.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: UserMessages.coachChatNoMessage };
  }

  const normalized: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: string }).role;
    const content = (m as { content?: string }).content;
    if ((role === "user" || role === "assistant") && typeof content === "string" && content.trim()) {
      normalized.push({ role, content: content.trim().slice(0, 8000) });
    }
  }

  if (normalized.length === 0) return { ok: false, error: UserMessages.coachChatBadThread };
  if (normalized[normalized.length - 1]?.role !== "user") {
    return { ok: false, error: UserMessages.coachChatLastMustBeUser };
  }

  if (globalOff) {
    if (!isWebSearchKnowledgeConfigured()) {
      return {
        ok: false,
        error:
          "Administrator wyłączył AI. Integracja z internetem nie jest skonfigurowana (GOOGLE_CUSTOM_SEARCH_API_KEY + GOOGLE_CUSTOM_SEARCH_ENGINE_ID).",
      };
    }
    const web = await fetchWebKnowledgeForCoachQuery(buildCoachSearchQuery(normalized));
    if (!web) {
      return {
        ok: false,
        error: "Nie udało się pobrać odpowiedzi z internetu. Spróbuj ponownie za chwilę.",
      };
    }
    return { ok: true, reply: web, webFallback: true };
  }

  const [rc, profile] = await Promise.all([
    buildCoachRecentContext(session.user.id),
    buildCoachUserProfile(session.user.id),
  ]);

  try {
    const coach = await chatCoach({
      messages: normalized,
      context: {
        userProfile: profile,
        recentContext: rc,
        guardrails: { tone: "supportive" },
      },
    });
    const reply = coach.text.trim() || UserMessages.coachChatEmptyReply;
    return {
      ok: true,
      reply,
      ...(coach.source === "web" ? { webFallback: true as const } : {}),
    };
  } catch (e) {
    return { ok: false, error: mapCoachAiThrowable(e) };
  }
}
