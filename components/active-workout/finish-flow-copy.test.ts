import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regresja ADR 0004 p.8 / AC-9.2: żaden plik przepływu zakończenia treningu nie
 * używa czerwonego CTA `#FF1A4B` (jeden złoty kolor akcji zakończenia/zapisu).
 * `workout-plan-card.tsx` jest poza zakresem (D-14, badge niezwiązany z zakończeniem).
 */
const ACTIVE_WORKOUT_DIR = path.resolve(__dirname);
const EXCLUDED_FILES = new Set(["workout-plan-card.tsx"]);

function componentFiles(): string[] {
  return readdirSync(ACTIVE_WORKOUT_DIR)
    .filter((f) => f.endsWith(".tsx") && !EXCLUDED_FILES.has(f))
    .map((f) => path.join(ACTIVE_WORKOUT_DIR, f));
}

describe("active-workout: brak czerwonego CTA #FF1A4B poza workout-plan-card.tsx", () => {
  it.each(componentFiles())("%s nie zawiera #FF1A4B", (file) => {
    const content = readFileSync(file, "utf8");
    expect(content).not.toMatch(/#FF1A4B/i);
  });
});

/**
 * Mikrokopia zakazana w przepływie zakończenia (005, sekcja 9 „Zakazane”):
 * dawne nazwy zdarzenia i teksty, które przeczyłyby momentowi zapisu (LR-2).
 */
const FORBIDDEN_PHRASES = [
  "Trening zrobiony",
  "Trening zapisany",
  "Zamknij (nie zapisuje)",
  "Wszystkie serie wykonane",
  "Po „Gotowe”",
];

describe("active-workout: brak zakazanej mikrokopii przepływu zakończenia", () => {
  const files = componentFiles();
  for (const phrase of FORBIDDEN_PHRASES) {
    it(`żaden plik nie zawiera „${phrase}”`, () => {
      for (const file of files) {
        const content = readFileSync(file, "utf8");
        expect(content.includes(phrase)).toBe(false);
      }
    });
  }
});
