import type { GymPlace } from "@/lib/gym-partner/types";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchNearby";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.regularOpeningHours.openNow",
  "places.regularOpeningHours.weekdayDescriptions",
].join(",");

type RawPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  websiteUri?: string;
  googleMapsUri?: string;
  regularOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
};

function safeHttpUrl(v: string | undefined): string | null {
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function parsePlaces(json: unknown): GymPlace[] {
  const raw = (json as { places?: RawPlace[] } | null)?.places;
  if (!Array.isArray(raw)) return [];
  const out: GymPlace[] = [];
  for (const p of raw) {
    const lat = p.location?.latitude;
    const lng = p.location?.longitude;
    const name = p.displayName?.text?.trim();
    if (!p.id || !name || typeof lat !== "number" || typeof lng !== "number") continue;
    out.push({
      id: p.id,
      name,
      address: p.formattedAddress ?? null,
      lat,
      lng,
      website: safeHttpUrl(p.websiteUri),
      mapsUrl: safeHttpUrl(p.googleMapsUri),
      openNow:
        typeof p.regularOpeningHours?.openNow === "boolean"
          ? p.regularOpeningHours.openNow
          : null,
      hours: Array.isArray(p.regularOpeningHours?.weekdayDescriptions)
        ? p.regularOpeningHours.weekdayDescriptions.filter((x) => typeof x === "string")
        : [],
    });
  }
  return out;
}

/** Places API (New) — bez cache'owania wyników (warunki Google). */
export async function searchNearbyGyms(
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<GymPlace[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY missing");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: ["gym", "fitness_center"],
      maxResultCount: 20,
      languageCode: "pl",
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters },
      },
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Places API ${res.status}`);
  return parsePlaces(await res.json());
}
