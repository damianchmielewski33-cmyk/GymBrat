/** Placeholders / bramki reklamowe dla użytkowników bez pakietu. */

export const AD_PLACEMENTS = [
  "before_workout_start",
  "before_add_product",
  "before_add_meal",
  "generic",
] as const;

export type AdPlacement = (typeof AD_PLACEMENTS)[number];

export function isAdPlacement(v: unknown): v is AdPlacement {
  return (
    typeof v === "string" &&
    (AD_PLACEMENTS as readonly string[]).includes(v)
  );
}
