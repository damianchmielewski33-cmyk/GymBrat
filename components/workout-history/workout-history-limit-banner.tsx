/** Podpis limitu 400 sesji — tylko gdy zapytanie faktycznie ucięło wynik. */
export function WorkoutHistoryLimitBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <p
      id="history-tonnage-limit"
      className="mt-2 px-0.5 text-[12px] leading-4 text-[var(--gym-text-secondary)]"
    >
      Tonaż liczymy z 400 ostatnich treningów. Starsze się nie wliczają.
    </p>
  );
}
