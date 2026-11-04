/**
 * Z66: jedyne miejsce w TypeScript z literałami koloru marki — tylko dla kontekstów,
 * w których CSS `var()` nie działa (Recharts/SVG jako props, eksport). Wartości muszą
 * zgadzać się z `app/globals.css` (pilnuje tego `lib/brand-color-literals.test.ts`).
 * W klasach Tailwind i stylach używaj `var(--gym-gold)` / `rgba(var(--neon-rgb), α)`.
 */
export const BRAND_GOLD = "#ebc44a";
export const BRAND_GOLD_BRIGHT = "#f7e28f";
export const BRAND_GOLD_DEEP = "#c49a1f";
export const BRAND_ON_GOLD = "#1a1408";
