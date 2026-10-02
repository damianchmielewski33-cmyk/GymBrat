export const BRANDING_SLOTS = [
  "logo_app",
  "logo_login",
  "icon_web",
  "icon_pwa",
  "icon_android",
  "icon_ios",
] as const;

export type BrandingSlot = (typeof BRANDING_SLOTS)[number];

export const BRANDING_SLOT_LABELS: Record<BrandingSlot, string> = {
  logo_app: "Logo w aplikacji (nagłówek)",
  logo_login: "Logo na logowaniu",
  icon_web: "Ikona web / favicon",
  icon_pwa: "Ikona PWA / „Dodaj do ekranu”",
  icon_android: "Ikona Android (launcher — kolejny build APK)",
  icon_ios: "Ikona iOS / Apple touch",
};

export function isBrandingSlot(v: string): v is BrandingSlot {
  return (BRANDING_SLOTS as readonly string[]).includes(v);
}
