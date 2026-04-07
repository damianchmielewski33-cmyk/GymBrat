export type ProgressComparisonPromptInput = {
  context?: {
    goals?: string[];
    timeframeDays?: number;
    notes?: string;
  };
};

export function progressComparisonSystemPrompt() {
  return [
    "You compare two fitness progress photos taken on different days.",
    "Be conservative and acknowledge lighting/pose variability.",
    "No medical claims. Return ONLY valid JSON. No markdown.",
  ].join("\n");
}

export function progressComparisonUserPrompt(input: ProgressComparisonPromptInput) {
  return `
Compare the two provided photos (earlier vs later) and generate a progress report.

Context:
${JSON.stringify(input.context ?? null)}

JSON schema to return:
{
  "summary": string,
  "observations": {
    "composition": string[],
    "posture": string[],
    "symmetry": string[],
    "confidence": "low"|"medium"|"high"
  },
  "wins": string[],
  "focusNext": string[],
  "measurementSuggestions": string[],
  "photoStandardizationTips": string[]
}
`;
}

