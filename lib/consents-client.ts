/** Stałe zgód dostępne też w komponencie klienckim (bez server-only). */

export const CURRENT_CONSENT_TEXT_VERSION = "2026-10-v1";

/** C-T1 / C-T2 — redesign Team (012); analytics/marketing — istniejące. */
export const CONSENT_TYPES = [
  "analytics",
  "marketing",
  "team_ranking",
  "team_cardio",
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export const CONSENT_SOURCES = [
  "banner",
  "profile",
  "android_bridge",
  "team_hub",
  "team_join",
] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

/** Wersja tekstu zgód rankingowych (LR-T20) — zmieniać przy zmianie mikrokopii. */
export const TEAM_RANKING_CONSENT_TEXT_VERSION = "2026-10-team-v1";
