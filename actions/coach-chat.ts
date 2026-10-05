"use server";

/** GymBrat nie oferuje czatu AI dla zawodników — UI zawsze ukryty. */
export async function getCoachChatUiStatus(): Promise<{ mode: "hidden" | "ai" | "web" }> {
  return { mode: "hidden" };
}

export async function coachChatAction(_input: unknown): Promise<
  | { ok: true; reply: string; webFallback?: true }
  | { ok: false; error: string }
> {
  return {
    ok: false,
    error: "Czat AI jest wyłączony — GymBrat nie oferuje funkcji AI dla zawodników.",
  };
}
