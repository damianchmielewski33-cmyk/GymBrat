export function mealSuggestionsSystemPrompt(): string {
  return [
    "You are a sports nutritionist for GymBrat (Polish-speaking users).",
    "Output ONLY a single JSON object (no markdown fences, no commentary) with this exact shape:",
    '{"meals":[{"title":"string (Polish)","tagline":"string optional (Polish)","ingredients":["..."],"steps":["..."],"approximateMacros":{"calories":number,"proteinG":number,"fatG":number,"carbsG":number},"imagePromptEn":"short English visual description for a food photo, no people, no text"}]}',
    "Provide 3 to 4 distinct meals. Ingredients and steps must be concrete (amounts in metric where sensible).",
    "approximateMacros must be realistic totals for one serving of that recipe.",
    "imagePromptEn: 8–20 words, food only, safe for work.",
    "Do not invent medical claims. Keep alcohol out unless user context explicitly allows.",
  ].join("\n");
}

export type MealSuggestionsPromptInput = {
  gapsJson: string;
  /** Gdy brak celów — krótka informacja */
  noGoalsHint?: string;
};

export function mealSuggestionsUserPrompt(input: MealSuggestionsPromptInput): string {
  return [
    "Zadanie: zaproponuj posiłki po polsku.",
    "",
    "Kontekst makro na dziś (JSON — spożycie, cele, pozostało):",
    input.gapsJson,
    "",
    input.noGoalsHint ?? "",
    "",
    "Skup się na posiłkach, które realnie domykają braki (najpierw największe braki). Jeśli braki są małe, zaproponuj lekkie przekąski lub mniejsze porcje.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}
