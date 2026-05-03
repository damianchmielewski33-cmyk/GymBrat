export function mealSuggestionsSystemPrompt(): string {
  return [
    "You are a sports nutritionist for GymBrat (Polish-speaking users).",
    "Output ONLY a single JSON object (no markdown fences, no commentary) with this exact shape:",
    '{"meals":[{"title":"string (Polish)","tagline":"string optional (Polish)","ingredients":["..."],"steps":["..."],"approximateMacros":{"calories":number,"proteinG":number,"fatG":number,"carbsG":number},"imagePromptEn":"short English visual description for a food photo, no people, no text"}]}',
    "Provide exactly 4 distinct meals (four objects in meals[]). Ingredients and steps must be concrete (amounts in metric where sensible).",
    "approximateMacros must be realistic totals for one serving of that recipe.",
    "imagePromptEn: 8–20 words, food only, safe for work.",
    "The user message includes LOCAL CALENDAR TIME and MEAL-PERIOD RULES in Polish. Every title + recipe MUST fit that time of day (e.g. no full lunch plates during breakfast hours, no breakfast-only cereal lineups during dinner hours). If macros push toward one macro, still respect the meal period.",
    "DIVERSITY (mandatory): the four meals must clearly differ — vary primary protein (e.g. poultry, fish, dairy/cultured, beef/pork occasionally, pulses), starch/base (bread, grain, potato, legume pasta, salad-first), and cooking mode (baked, stewed, raw salad, one-pan, soup). Do NOT output four near-copies of the same idea (e.g. four chicken-rice bowls with tiny wording changes). Vary Polish vs Mediterranean vs simple Asian-inspired profiles across meals when sensible.",
    "Do not invent medical claims. Keep alcohol out unless user context explicitly allows.",
  ].join("\n");
}

export type MealSuggestionsPromptInput = {
  gapsJson: string;
  /** Gdy brak celów — krótka informacja */
  noGoalsHint?: string;
  /** Linia czasu z kalendarza (np. „Teraz jest … — to ranek.”) */
  localCalendarLinePl: string;
  /** Reguły pory posiłku po polsku — model musi je przestrzegać */
  mealTimeRulesPl: string;
};

export function mealSuggestionsUserPrompt(input: MealSuggestionsPromptInput): string {
  return [
    "Zadanie: zaproponuj posiłki po polsku.",
    "",
    "Czas lokalny (kalendarz żywienia w aplikacji):",
    input.localCalendarLinePl,
    "",
    "Zasady pory posiłku — OBOWIĄZKOWE (wszystkie propozycje muszą im odpowiadać):",
    input.mealTimeRulesPl,
    "",
    "Kontekst makro na dziś (JSON — spożycie, cele, pozostało):",
    input.gapsJson,
    "",
    input.noGoalsHint ?? "",
    "",
    "Skup się na posiłkach, które realnie domykają braki (najpierw największe braki). Jeśli braki są małe, zaproponuj lekkie przekąski lub mniejsze porcje — ale nadal zachowaj różnorodność i zgodność z porą dnia.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}
