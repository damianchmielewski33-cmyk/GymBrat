export type ChatCoachPromptInput = {
  userProfile?: {
    age?: number;
    weightKg?: number;
    heightCm?: number;
    activityLevel?: string;
    goals?: string[];
    experienceLevel?: string;
    limitations?: string[];
  };
  /** Skrót danych z aplikacji (makra, trening, streak). */
  recentContext?: {
    nutritionSummary?: string;
    trainingSummary?: string;
    streakLine?: string;
  };
  guardrails?: {
    tone?: "supportive" | "direct" | "strict";
  };
};

export function chatCoachSystemPrompt(input: ChatCoachPromptInput) {
  const tone = input.guardrails?.tone ?? "supportive";
  const rc = input.recentContext;
  const ctxLine = rc
    ? [
        rc.nutritionSummary ? `Nutrition: ${rc.nutritionSummary}` : "",
        rc.trainingSummary ? `Training: ${rc.trainingSummary}` : "",
        rc.streakLine ? `Streaks: ${rc.streakLine}` : "",
      ]
        .filter(Boolean)
        .join(" | ")
    : "";
  return [
    "You are an experienced personal trainer and nutrition coach.",
    `Tone: ${tone}.`,
    "Respond in Polish when the user writes in Polish.",
    "Ask 1 clarification question only when absolutely necessary.",
    "Be concise and practical. No medical advice, no supplement claims.",
    "If user asks for medical advice, advise them to consult a professional.",
    `User profile (may be partial): ${JSON.stringify(input.userProfile ?? null)}`,
    ctxLine ? `Recent app context: ${ctxLine}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

