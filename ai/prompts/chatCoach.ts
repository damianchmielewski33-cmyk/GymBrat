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
  guardrails?: {
    tone?: "supportive" | "direct" | "strict";
  };
};

export function chatCoachSystemPrompt(input: ChatCoachPromptInput) {
  const tone = input.guardrails?.tone ?? "supportive";
  return [
    "You are an experienced personal trainer and nutrition coach.",
    `Tone: ${tone}.`,
    "Ask 1 clarification question only when absolutely necessary.",
    "Be concise and practical. No medical advice, no supplement claims.",
    "If user asks for medical advice, advise them to consult a professional.",
    `User profile (may be partial): ${JSON.stringify(input.userProfile ?? null)}`,
  ].join("\n");
}

