/** Mapowanie ścieżki URL → klucz ekranu (analityka + etykiety w panelu). */

export const SCREEN_LABELS: Record<string, string> = {
  home: "Start",
  active_workout: "Trening na żywo",
  workout_plan: "Plan treningowy",
  reports: "Raporty ciała",
  progress_analysis: "Analiza postępów",
  profile: "Profil",
  login: "Logowanie",
  register: "Rejestracja",
  admin: "Panel administratora",
  other: "Inna strona",
};

export function getScreenFromPathname(
  pathname: string | null,
): { key: string; label: string } | null {
  if (!pathname || pathname.startsWith("/admin")) return null;
  if (pathname.startsWith("/api")) return null;
  if (pathname.startsWith("/_next")) return null;

  const path = pathname.split("?")[0] ?? pathname;
  if (path === "/") return { key: "home", label: SCREEN_LABELS.home };
  if (path.startsWith("/active-workout"))
    return { key: "active_workout", label: SCREEN_LABELS.active_workout };
  if (path.startsWith("/workout-plan"))
    return { key: "workout_plan", label: SCREEN_LABELS.workout_plan };
  if (path.startsWith("/reports"))
    return { key: "reports", label: SCREEN_LABELS.reports };
  if (path.startsWith("/progress-analysis"))
    return { key: "progress_analysis", label: SCREEN_LABELS.progress_analysis };
  if (path.startsWith("/profile"))
    return { key: "profile", label: SCREEN_LABELS.profile };
  if (path.startsWith("/login"))
    return { key: "login", label: SCREEN_LABELS.login };
  if (path.startsWith("/register"))
    return { key: "register", label: SCREEN_LABELS.register };

  return { key: "other", label: SCREEN_LABELS.other };
}
