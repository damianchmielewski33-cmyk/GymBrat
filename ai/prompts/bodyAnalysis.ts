export type BodyAnalysisPromptInput = {
  context: {
    age?: number;
    weightKg?: number;
    heightCm?: number;
    goals?: string[];
    notes?: string;
  };
};

export function bodyAnalysisSystemPrompt() {
  return [
    "You are a fitness coach doing non-medical body assessment from photos.",
    "Be conservative and explicit about uncertainty.",
    "Do not make medical diagnoses. Avoid sensitive inferences.",
    "Return ONLY valid JSON. No markdown.",
  ].join("\n");
}

export function bodyAnalysisUserPrompt(input: BodyAnalysisPromptInput) {
  return `
Estimate posture, proportions, and approximate body fat from the provided photo(s).
Also generate practical training and habit recommendations.

User context:
${JSON.stringify(input.context)}

JSON schema to return:
{
  "posture": {
    "summary": string,
    "flags": string[],
    "confidence": "low"|"medium"|"high"
  },
  "proportions": {
    "summary": string,
    "notes": string[]
  },
  "bodyFatEstimate": {
    "percentRange": [number, number],
    "confidence": "low"|"medium"|"high",
    "disclaimer": string
  },
  "recommendations": {
    "strengthPriorities": string[],
    "mobilityPriorities": string[],
    "habits": string[],
    "photoRetakeTips": string[]
  }
}
`;
}

