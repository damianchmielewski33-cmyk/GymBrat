"use server";

import { auth } from "@/auth";
import { chatCoach } from "@/ai/coach";
import { buildCoachRecentContext, buildCoachUserProfile } from "@/lib/coach-context";

export async function coachChatAction(input: unknown): Promise<
  | { ok: true; reply: string }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Brak sesji." };

  const raw = input as { messages?: unknown };
  const messages = raw.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: "Brak wiadomości." };
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

  if (normalized.length === 0) return { ok: false, error: "Nieprawidłowe wiadomości." };
  if (normalized[normalized.length - 1]?.role !== "user") {
    return { ok: false, error: "Ostatnia wiadomość musi być od użytkownika." };
  }

  const [rc, profile] = await Promise.all([
    buildCoachRecentContext(session.user.id),
    buildCoachUserProfile(session.user.id),
  ]);

  const reply = await chatCoach({
    messages: normalized,
    context: {
      userProfile: profile,
      recentContext: rc,
      guardrails: { tone: "supportive" },
    },
  });

  return { ok: true, reply: reply.trim() || "Brak odpowiedzi modelu." };
}
