/**
 * Wzbogaca składniki (gramatura) i kroki przepisu — używane przy generowaniu katalogu
 * i opcjonalnie przy wyświetlaniu.
 */

const AMOUNT_HINTS: Array<{ test: RegExp; amount: string }> = [
  { test: /^li[sś]cie\s+sałat/i, amount: "40 g" },
  { test: /^sałata/i, amount: "60 g" },
  { test: /^rukola/i, amount: "40 g" },
  { test: /^szpinak(?!\s+\d)/i, amount: "80 g" },
  { test: /^pomidorki/i, amount: "100 g" },
  { test: /^pomidor(?!ów)/i, amount: "120 g" },
  { test: /^ogórek/i, amount: "100 g" },
  { test: /^papryka/i, amount: "120 g" },
  { test: /^cebula/i, amount: "80 g" },
  { test: /^czosnek/i, amount: "1 ząbek" },
  { test: /^marchew/i, amount: "80 g" },
  { test: /^brokuł/i, amount: "150 g" },
  { test: /^kalafior/i, amount: "200 g" },
  { test: /^cukinia/i, amount: "150 g" },
  { test: /^awokado/i, amount: "1/2 szt. (~70 g)" },
  { test: /^banan/i, amount: "1 szt. (~120 g)" },
  { test: /^jabłko/i, amount: "1 szt. (~150 g)" },
  { test: /^gruszka/i, amount: "1 szt. (~160 g)" },
  { test: /^malin/i, amount: "50 g" },
  { test: /^truskawk/i, amount: "80 g" },
  { test: /^jagód|borówk/i, amount: "60 g" },
  { test: /^kiwi/i, amount: "1 szt. (~80 g)" },
  { test: /^wiśni|wisien/i, amount: "80 g" },
  { test: /^cytryn/i, amount: "1/2 szt. (sok)" },
  { test: /^dressing/i, amount: "30 g" },
  { test: /^musztard/i, amount: "1 łyżeczka (5 g)" },
  { test: /^oliw[ay]/i, amount: "1 łyżeczka (5 ml)" },
  { test: /^olej/i, amount: "1 łyżeczka (5 ml)" },
  { test: /^miód/i, amount: "1 łyżeczka (7 g)" },
  { test: /^woda$/i, amount: "200 ml" },
  { test: /^espresso|kawa/i, amount: "30–60 ml" },
  { test: /^przypraw/i, amount: "do smaku (ok. 2–3 g)" },
  { test: /^sól|pieprz/i, amount: "szczypta (~1 g)" },
  { test: /^cynamon/i, amount: "1 łyżeczka (2 g)" },
  { test: /^kakao/i, amount: "1 łyżeczka (5 g)" },
  { test: /^sos\s+teriyaki/i, amount: "20 ml" },
  { test: /^płatki\s+owsiane/i, amount: "30 g" },
  { test: /^ryż/i, amount: "50 g (suchej)" },
  { test: /^kasza/i, amount: "60 g (suchej)" },
  { test: /^zioł/i, amount: "2 g" },
  { test: /^koperek/i, amount: "5 g" },
  { test: /^natka|pietruszk/i, amount: "5 g" },
  { test: /^salsa/i, amount: "40 g" },
  { test: /^sok\s+z\s+cytryn/i, amount: "10 ml" },
  { test: /^kilka\s+malin/i, amount: "50 g" },
  { test: /^kilka\s+orzech/i, amount: "15 g" },
  { test: /^nerkowc/i, amount: "15 g" },
];

function hasQuantity(line: string): boolean {
  return /\d/.test(line) || /łyżk|łyżecz|szczypt|ząbek|kromk|szt/i.test(line);
}

/** Dopina brakującą gramaturę / miarę do składnika. */
export function enrichIngredientLine(raw: string): string {
  const line = raw.trim();
  if (!line) return line;
  if (hasQuantity(line)) return line;
  for (const { test, amount } of AMOUNT_HINTS) {
    if (test.test(line)) {
      return `${amount} ${line}`;
    }
  }
  // Ogólne: traktuj jako porcję wagową do odważenia
  return `porcja do odważenia: ${line}`;
}

/** Rozbija „60 g płatków…” na { amount, name } do UI. */
export function splitIngredientDisplay(line: string): { amount: string; name: string } {
  const enriched = enrichIngredientLine(line);
  const m = enriched.match(
    /^(\d+[.,]?\d*\s*(?:g|ml|kg|l)\b(?:\s*\([^)]+\))?|\d+\s*\/\s*\d+\s*szt\.[^ ]*(?:\s*\([^)]+\))?|\d+\s*szt\.[^ ]*(?:\s*\([^)]+\))?|\d+\s*łyże(?:k|czki|czek)?(?:\s*\([^)]+\))?|szczypta(?:\s*\([^)]+\))?|\d+[–-]\d+\s*ml|porcja do odważenia:)\s*(.*)$/i,
  );
  if (m) {
    return { amount: m[1]!.trim(), name: (m[2] || "").trim() || enriched };
  }
  // „1 jabłko” / „2 jajka”
  const m2 = enriched.match(/^(\d+\s*(?:\/\s*\d+\s*)?(?:szt\.?)?)\s+(.+)$/i);
  if (m2 && /jaj|banan|jabł|grusz|kiwi|kromk|ząbek|łyż/i.test(enriched)) {
    return { amount: m2[1]!.trim(), name: m2[2]!.trim() };
  }
  return { amount: "—", name: enriched };
}

function expandShortStep(step: string, index: number): string {
  const s = step.trim();
  if (s.length >= 55) return s;
  const lower = s.toLowerCase();
  if (/ugotuj|gotuj/.test(lower) && !/min|°/.test(lower)) {
    return `${s} Gotuj we właściwej ilości płynu (zwykle 8–15 min), aż będzie miękki; odcedź, jeśli trzeba.`;
  }
  if (/smaż|usmaż|podsmaż/.test(lower) && !/min|średn|ogniu/.test(lower)) {
    return `${s} Na średnim ogniu z 1 łyżeczką tłuszczu, 4–8 min, aż nabierze koloru.`;
  }
  if (/piecz|upiecz/.test(lower) && !/°|min/.test(lower)) {
    return `${s} W piekarniku 180°C przez 12–20 min do zarumienienia.`;
  }
  if (/zblenduj|zmiksuj/.test(lower) && s.length < 45) {
    return `${s} Miksuj 20–40 s, aż konsystencja będzie gładka; dolej odrobinę płynu, jeśli za gęste.`;
  }
  if (index === 0 && s.length < 40) {
    return `Najpierw odważ składniki z listy. ${s}`;
  }
  return s;
}

/** Dopina szczegółowe kroki (jak odważyć, gotować, łączyć). */
export function enrichRecipeSteps(steps: string[]): string[] {
  const base = steps.map((s) => s.trim()).filter(Boolean);
  let expanded = base.map((s, i) => expandShortStep(s, i));
  if (expanded.length < 3) {
    expanded.push(
      "Na koniec sprawdź konsystencję i smak; dopraw szczyptą soli lub przyprawami z listy.",
    );
  }
  if (expanded.length < 4) {
    expanded = [
      "Odważ dokładnie składniki wagą kuchenną i przygotuj naczynia (patelnia / garnek / piekarnik).",
      ...expanded,
    ];
  }
  return expanded.slice(0, 10);
}

export function enrichRecipeContent(meal: {
  ingredients: string[];
  steps: string[];
}): { ingredients: string[]; steps: string[] } {
  return {
    ingredients: meal.ingredients.map(enrichIngredientLine),
    steps: enrichRecipeSteps(meal.steps),
  };
}
