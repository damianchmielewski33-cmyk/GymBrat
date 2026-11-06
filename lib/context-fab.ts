/**
 * Z59: kontekstowy środkowy przycisk dolnej belki. Etykieta i cel zależą od ekranu:
 * Treningi → „Start”, Dieta → „Dodaj posiłek”, Analiza i Start → „Raport”.
 * Na pozostałych ekranach (Społeczność, Profil, podekrany planów) przycisku nie ma.
 */
export type ContextFab = {
  kind: "start" | "meal" | "report";
  href: string;
  label: string;
  ariaLabel: string;
};

export function resolveContextFab(pathname: string): ContextFab | null {
  if (pathname.startsWith("/workout-plan")) {
    return {
      kind: "start",
      href: "/workout-plan#next-workout",
      label: "Start",
      ariaLabel: "Start, rozpocznij trening",
    };
  }
  if (pathname.startsWith("/meal-suggestions")) {
    return {
      kind: "meal",
      href: "/meal-suggestions?tab=diary&add=1",
      label: "Dodaj posiłek",
      ariaLabel: "Dodaj posiłek",
    };
  }
  if (pathname === "/" || pathname.startsWith("/progress")) {
    return {
      kind: "report",
      href: "/reports?new=1",
      label: "Raport",
      ariaLabel: "Dodaj raport",
    };
  }
  return null;
}
