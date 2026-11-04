import { LEGAL_VERSIONS } from "@/lib/legal-versions";
/** Stałe zgód dostępne też w komponencie klienckim (bez server-only). */

export const CURRENT_CONSENT_TEXT_VERSION = "2026-10-v1";

/** C-T1 / C-T2 — redesign Team (012); analytics/marketing — istniejące. */
export const CONSENT_TYPES = [
  "analytics",
  "marketing",
  "team_ranking",
  "team_cardio",
  /** US3/Z11: dane o ciele i zdrowiu (art. 9 RODO) — raport ciała, pomiary, tętno. */
  "health",
  /** US3/Z11: zdjęcia sylwetki i zdjęcia z urządzeń (osobna zgoda od danych liczbowych). */
  "photos",
  /** US3/Z81: przypomnienia treningowe (push PWA / Android, skrót e-mail). */
  "push",
  /** US3/Z13: oświadczenie o wieku 16+ (zapis dowodowy, nie zgoda marketingowa). */
  "age_16",
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export const CONSENT_SOURCES = [
  "banner",
  "profile",
  "android_bridge",
  "team_hub",
  "team_join",
  "registration",
  "body_report",
  "photos_upload",
  "reminders",
  "age_gate",
] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

/** Wersja tekstu zgód rankingowych (LR-T20) — zmieniać przy zmianie mikrokopii. */
export const TEAM_RANKING_CONSENT_TEXT_VERSION = "2026-10-team-v1";

/**
 * Zgody, bez których serwer odmawia zapisu danych (US3/Z11). Treści zgód to SZKIC do zatwierdzenia
 * przez prawnika (US7/Z15) — wersja z sufiksem `-szkic` zmieni się po zatwierdzeniu.
 */
export const SENSITIVE_CONSENT_TYPES = ["health", "photos"] as const;
export type SensitiveConsentType = (typeof SENSITIVE_CONSENT_TYPES)[number];

export const SENSITIVE_CONSENT_TEXT_VERSION: string = LEGAL_VERSIONS.sensitiveConsents;

export const SENSITIVE_CONSENT_COPY: Record<
  SensitiveConsentType,
  { title: string; body: string; cta: string }
> = {
  health: {
    title: "Zgoda na dane o ciele i zdrowiu",
    body: "Raporty ciała, pomiary, waga i parametry treningu (np. tętno) to dane o zdrowiu. Zapisujemy je tylko za Twoją zgodą, używamy do wyliczeń i wykresów w aplikacji. Możesz ją cofnąć w Profilu, a dane usunąć razem z kontem.",
    cta: "Zgadzam się na zapis danych o ciele",
  },
  photos: {
    title: "Zgoda na zdjęcia sylwetki",
    body: "Zdjęcia sylwetki i zdjęcia z urządzeń to dane szczególnej kategorii. Zapisujemy je tylko za Twoją zgodą i pokazujemy wyłącznie Tobie. Możesz ją cofnąć w Profilu, a zdjęcia usunąć.",
    cta: "Zgadzam się na zapis zdjęć",
  },
};
