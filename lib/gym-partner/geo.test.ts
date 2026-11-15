import { describe, expect, it } from "vitest";
import { boundingBox, fuzzLocation, haversineMeters, isValidCoord, roundedDistanceKm } from "@/lib/gym-partner/geo";
import { parsePlaces } from "@/lib/gym-partner/places";

describe("geo", () => {
  it("fuzzLocation: zaokrągla do siatki i jest stabilne w obrębie komórki", () => {
    const a = fuzzLocation(52.22971, 21.01221);
    const b = fuzzLocation(52.22975, 21.01225);
    expect(a).toEqual(b);
    expect(haversineMeters({ lat: 52.22971, lng: 21.01221 }, a)).toBeLessThan(450);
    expect(a).not.toEqual({ lat: 52.22971, lng: 21.01221 });
  });
  it("isValidCoord odrzuca NaN i zakresy", () => {
    expect(isValidCoord(NaN, 0)).toBe(false);
    expect(isValidCoord(91, 0)).toBe(false);
    expect(isValidCoord(52, 21)).toBe(true);
  });
  it("haversine ~111 km na stopień szerokości", () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
  it("boundingBox zawiera środek, roundedDistanceKm nie schodzi poniżej 0,5", () => {
    const b = boundingBox({ lat: 52, lng: 21 }, 5000);
    expect(b.minLat).toBeLessThan(52);
    expect(b.maxLng).toBeGreaterThan(21);
    expect(roundedDistanceKm(10)).toBe(0.5);
    expect(roundedDistanceKm(1200)).toBe(1.5);
  });
});

describe("parsePlaces", () => {
  it("mapuje pola, pomija niekompletne i niebezpieczne URL", () => {
    const out = parsePlaces({
      places: [
        {
          id: "p1",
          displayName: { text: "Zdrofit Mokotów" },
          location: { latitude: 52.2, longitude: 21 },
          websiteUri: "javascript:alert(1)",
          googleMapsUri: "https://maps.google.com/?cid=1",
          regularOpeningHours: { openNow: true, weekdayDescriptions: ["poniedziałek: 06:00–22:00"] },
        },
        { id: "p2" },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].website).toBeNull();
    expect(out[0].mapsUrl).toContain("maps.google.com");
    expect(out[0].openNow).toBe(true);
    expect(parsePlaces(null)).toEqual([]);
  });
});
