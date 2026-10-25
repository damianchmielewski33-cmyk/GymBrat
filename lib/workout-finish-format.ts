import { formatKgPl } from "@/lib/set-progression-suggestion";

export function formatWorkoutDurationPl(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h} h ${m} min`;
  if (h > 0) return `${h} h`;
  if (m > 0) return `${m} min`;
  return `${Math.max(1, s)} s`;
}

export function formatTonnagePl(kg: number): string {
  const n = Math.max(0, Math.round(kg));
  return `${new Intl.NumberFormat("pl-PL").format(n)} kg`;
}

/**
 * Liczby całkowite w formacie polskim (odstęp jako separator tysięcy, np. `4500` ->
 * `4 500`) — podsumowanie cardio na ekranie „Trening zakończony” (005, przegląd ux
 * sekcja 19, pkt 3): `3,2 km`, `4 500 kroków`.
 */
export function formatCountPl(n: number): string {
  // `useGrouping: true` wymuszone explicite — domyślne „auto” dla `pl-PL` nie grupuje
  // liczb 4-cyfrowych (1000-9999, reguła CLDR „min2”), a makieta wymaga spacji nawet
  // dla `4500` -> `4 500`.
  return new Intl.NumberFormat("pl-PL", { useGrouping: true }).format(Math.round(n));
}

/** Dystans cardio z przecinkiem dziesiętnym, do jednego miejsca po przecinku. */
export function formatDistanceKmPl(km: number): string {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1, useGrouping: true }).format(
    km,
  );
}

/** `82,5 kg → 85 kg` — jednostka przy obu wartościach (005, przegląd ux 21.3 W-3). */
export function formatWeightRecordLine(previousKg: number, newKg: number): string {
  return `${formatKgPl(previousKg)} kg → ${formatKgPl(newKg)} kg`;
}
