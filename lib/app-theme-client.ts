import { THEME_COOKIE, type AppTheme } from "@/lib/app-theme";

/** Natychmiast stosuje motyw w przeglądarce (atrybut na <html> + ciasteczko do pierwszego renderu). */
export function applyAppTheme(theme: AppTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  try {
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* ciasteczka zablokowane — motyw nadal działa do końca sesji strony */
  }
}
