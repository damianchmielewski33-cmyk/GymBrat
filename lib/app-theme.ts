/** Motywy aplikacji: kolor akcentu na czarnym tle. Tokeny CSS: `html[data-theme="…"]` w app/globals.css. */

export const APP_THEMES = ["gold", "pink", "violet", "teal", "red", "blue"] as const;
export type AppTheme = (typeof APP_THEMES)[number];

export const DEFAULT_APP_THEME: AppTheme = "gold";
export const THEME_COOKIE = "gb-theme";

export const APP_THEME_LABELS: Record<AppTheme, string> = {
  gold: "Złoto i czerń",
  pink: "Róż i czerń",
  violet: "Fiolet",
  teal: "Turkus",
  red: "Czerwień",
  blue: "Błękit",
};

/** Zwraca poprawny motyw albo domyślny (złoty). */
export function parseAppTheme(raw: unknown): AppTheme {
  return typeof raw === "string" && (APP_THEMES as readonly string[]).includes(raw)
    ? (raw as AppTheme)
    : DEFAULT_APP_THEME;
}

/** Przycisk na pasku bocznym: złoto ↔ róż (każdy inny kolor → złoto). */
export function nextQuickTheme(current: AppTheme): AppTheme {
  return current === "gold" ? "pink" : "gold";
}
