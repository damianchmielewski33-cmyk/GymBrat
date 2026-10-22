/** Preferencje zgód cookies / RODO (localStorage). */

export const CONSENT_STORAGE_KEY = "gymbrat_consent_v1";
export const CONSENT_CHANGED_EVENT = "gymbrat:consent-changed";

export type ConsentPreferences = {
  version: 1;
  /** ISO — kiedy użytkownik zapisał wybór. */
  decidedAt: string;
  /** Analityka (page-view, PostHog). */
  analytics: boolean;
  /** Marketing / reklamy AdMob i bramka web. */
  marketing: boolean;
};

export type ConsentCategory = "analytics" | "marketing";

export function defaultConsentPreferences(
  partial?: Partial<Pick<ConsentPreferences, "analytics" | "marketing">>,
): ConsentPreferences {
  return {
    version: 1,
    decidedAt: new Date().toISOString(),
    analytics: partial?.analytics ?? false,
    marketing: partial?.marketing ?? false,
  };
}

export function parseConsentPreferences(
  raw: string | null | undefined,
): ConsentPreferences | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(raw) as Partial<ConsentPreferences>;
    if (data?.version !== 1 || typeof data.decidedAt !== "string") return null;
    return {
      version: 1,
      decidedAt: data.decidedAt,
      analytics: Boolean(data.analytics),
      marketing: Boolean(data.marketing),
    };
  } catch {
    return null;
  }
}

export function readConsentPreferences(): ConsentPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    return parseConsentPreferences(localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function hasConsentDecision(): boolean {
  return readConsentPreferences() != null;
}

export function writeConsentPreferences(prefs: ConsentPreferences): void {
  if (typeof window === "undefined") return;
  const next: ConsentPreferences = {
    version: 1,
    decidedAt: prefs.decidedAt || new Date().toISOString(),
    analytics: Boolean(prefs.analytics),
    marketing: Boolean(prefs.marketing),
  };
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  try {
    window.dispatchEvent(
      new CustomEvent(CONSENT_CHANGED_EVENT, { detail: next }),
    );
  } catch {
    /* ignore */
  }
  syncConsentToAndroidBridge(next);
}

export function acceptAllConsent(): ConsentPreferences {
  const prefs = defaultConsentPreferences({
    analytics: true,
    marketing: true,
  });
  writeConsentPreferences(prefs);
  return prefs;
}

export function rejectOptionalConsent(): ConsentPreferences {
  const prefs = defaultConsentPreferences({
    analytics: false,
    marketing: false,
  });
  writeConsentPreferences(prefs);
  return prefs;
}

/** Czy wolno zbierać analitykę (page-view / PostHog). */
export function canUseAnalytics(prefs?: ConsentPreferences | null): boolean {
  const p = prefs ?? readConsentPreferences();
  return Boolean(p?.analytics);
}

/** Czy wolno pokazywać reklamy (AdMob / bramka). */
export function canUseMarketing(prefs?: ConsentPreferences | null): boolean {
  const p = prefs ?? readConsentPreferences();
  return Boolean(p?.marketing);
}

function syncConsentToAndroidBridge(prefs: ConsentPreferences): void {
  if (typeof window === "undefined") return;
  const bridge = window.GymBratAndroid;
  if (bridge && typeof bridge.setMarketingConsent === "function") {
    try {
      bridge.setMarketingConsent(Boolean(prefs.marketing));
    } catch {
      /* ignore */
    }
  }
}

/** Po załadowaniu strony — dograj most Android do zapisanego wyboru. */
export function hydrateConsentToAndroidBridge(): void {
  const prefs = readConsentPreferences();
  if (prefs) syncConsentToAndroidBridge(prefs);
}
