/** Geometria dla partnerów treningowych. Czyste funkcje (bez serwera) — testowalne. */

export const GRID_METERS = 500;
const M_PER_DEG_LAT = 111_320;

export function isValidCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/**
 * Zaokrągla pozycję do środka komórki siatki ~500 m. Dokładna pozycja nigdy nie jest zapisywana
 * ani wysyłana innym użytkownikom.
 */
export function fuzzLocation(lat: number, lng: number): { lat: number; lng: number } {
  const stepLat = GRID_METERS / M_PER_DEG_LAT;
  const fLat = (Math.floor(lat / stepLat) + 0.5) * stepLat;
  const cos = Math.max(Math.cos((fLat * Math.PI) / 180), 0.01);
  const stepLng = GRID_METERS / (M_PER_DEG_LAT * cos);
  const fLng = (Math.floor(lng / stepLng) + 0.5) * stepLng;
  return { lat: Number(fLat.toFixed(5)), lng: Number(fLng.toFixed(5)) };
}

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function boundingBox(
  center: { lat: number; lng: number },
  radiusMeters: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const dLat = radiusMeters / M_PER_DEG_LAT;
  const cos = Math.max(Math.cos((center.lat * Math.PI) / 180), 0.01);
  const dLng = radiusMeters / (M_PER_DEG_LAT * cos);
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}

/** Odległość pokazywana innym: w górę do 0,5 km (nie zdradza dokładnej pozycji). */
export function roundedDistanceKm(meters: number): number {
  return Math.max(0.5, Math.ceil(meters / 500) / 2);
}
