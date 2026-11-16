import type { GymPlace } from "@/lib/gym-partner/types";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchNearby";
/** Maska „Pro” (tańsze zapytanie, większy darmowy próg): bez godzin i strony www — te pobieramy po kliknięciu. */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.googleMapsUri",
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

const TEXT_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

/** Wyszukiwanie po nazwie/marce (np. „zdrofit”) — najbliższe wyniki wokół użytkownika. */
export async function searchGymsByText(
  query: string,
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<GymPlace[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY missing");
  const res = await fetch(TEXT_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: `${query} siłownia`,
      languageCode: "pl",
      maxResultCount: 20,
      rankPreference: "DISTANCE",
      locationBias: {
        circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters },
      },
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Places API ${res.status}`);
  return parsePlaces(await res.json());
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

const PLACE_ID = /^[A-Za-z0-9_-]{10,200}$/;

export type PlaceDetails = Pick<GymPlace, "website" | "openNow" | "hours">;

export function parseDetails(json: unknown): PlaceDetails {
  const p = json as RawPlace | null;
  return {
    website: safeHttpUrl(p?.websiteUri),
    openNow:
      typeof p?.regularOpeningHours?.openNow === "boolean" ? p.regularOpeningHours.openNow : null,
    hours: Array.isArray(p?.regularOpeningHours?.weekdayDescriptions)
      ? p.regularOpeningHours.weekdayDescriptions.filter((x) => typeof x === "string")
      : [],
  };
}

/** Place Details (Enterprise: godziny + strona) — wołane tylko po kliknięciu siłowni. */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY missing");
  if (!PLACE_ID.test(placeId)) throw new Error("bad place id");
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pl`, {
    cache: "no-store",
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "id,websiteUri,regularOpeningHours.openNow,regularOpeningHours.weekdayDescriptions",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Places API ${res.status}`);
  return parseDetails(await res.json());
}
