export const CARDIO_MACHINES = [
  { id: "treadmill", label: "Bieżnia" },
  { id: "bike", label: "Rower stacjonarny" },
  { id: "elliptical", label: "Eliptyk" },
  { id: "rower", label: "Wioślarz" },
  { id: "stair", label: "Stepper / schody" },
  { id: "outdoor_run", label: "Bieg outdoor (GPS)" },
  { id: "outdoor_walk", label: "Marsz outdoor (GPS)" },
  { id: "other", label: "Inne" },
] as const;

export type CardioMachineId = (typeof CARDIO_MACHINES)[number]["id"];

export type GpsPoint = {
  lat: number;
  lng: number;
  t: number;
  accuracy?: number;
};

export function haversineKm(a: GpsPoint, b: GpsPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function routeDistanceKm(points: GpsPoint[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    sum += haversineKm(points[i - 1]!, points[i]!);
  }
  return Math.round(sum * 100) / 100;
}
