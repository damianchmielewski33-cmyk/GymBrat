/** Stałe zgód dostępne też w komponencie klienckim (bez server-only). */

export const CURRENT_CONSENT_TEXT_VERSION = "2026-10-v1";

export const CONSENT_TYPES = ["analytics", "marketing"] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export const CONSENT_SOURCES = ["banner", "profile", "android_bridge"] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];
