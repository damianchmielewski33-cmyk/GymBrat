/**
 * Grafika tła „NOWY MAX” — ten sam proxy Pollinations co przepisy
 * (`/api/recipe-image` + POLLINATIONS_API_KEY). Tekst nakładamy w UI.
 */

import {
  buildAppRecipeImageProxyUrl,
  POLLINATIONS_RAW_PROMPT_PREFIX,
} from "@/lib/pollinations-image";

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 1_000_000_000;
}

/**
 * Z27 (RODO): do zewnętrznego generatora (Pollinations) NIE trafiają dane osobowe — ani nazwa ćwiczenia
 * (może być wpisana przez użytkownika), ani ciężar, ani nic, co da się z nich wyprowadzić (seed).
 * `exerciseName` i `valueKg` służą wyłącznie do tekstu nakładanego w UI po stronie klienta.
 */
export type PrAchievementImageInput = {
  exerciseName: string;
  valueKg: number;
  atMs?: number;
};

/** Wersja promptu/seedu — podbij przy zmianie wyglądu; wpływa na cache grafiki. */
const PR_IMAGE_VERSION = "pr-v3";

/** Prompt cinematic — złoty puchar / medal na ławce, siłownia, bez tekstu i bez danych użytkownika. */
export function buildPrAchievementImagePrompt(_input?: PrAchievementImageInput): string {
  return [
    POLLINATIONS_RAW_PROMPT_PREFIX,
    "dramatic overhead spotlight",
    "black weightlifting bench in foreground",
    "gleaming gold trophy cup and gold medal with barbell emblem on black ribbon",
    "loaded barbell on rack in background",
    "high contrast gold and black luxury fitness aesthetic",
    "gritty professional gym atmosphere",
    "subtle dust motes in light beam",
    "mood of personal record celebration",
    "no people",
    "no text",
    "no letters",
    "no words",
    "no logo",
    "no watermark",
    "no brand name",
    "4k",
    "photorealistic",
  ].join(", ");
}

export function getPrAchievementImageUrl(input: PrAchievementImageInput): string {
  const prompt = buildPrAchievementImagePrompt(input);
  const day =
    input.atMs != null
      ? new Date(input.atMs).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  // Seed tylko z daty (wariant dzienny) — bez nazwy ćwiczenia i ciężaru.
  const seed = hashSeed(`${day}|${PR_IMAGE_VERSION}`);
  return buildAppRecipeImageProxyUrl({
    prompt,
    seed,
    width: 768,
    height: 1024,
    model: "flux",
    mode: "raw",
  });
}

export function formatPrDateLabel(atMs?: number): string {
  const d = atMs != null ? new Date(atMs) : new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function formatPrWeightLabel(kg: number): string {
  const n = Math.round(kg * 10) / 10;
  const text = Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
  return `${text} KG`;
}
