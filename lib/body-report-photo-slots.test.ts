import { describe, expect, it } from "vitest";
import {
  frontBodyReportPhotoDataUrl,
  sortBodyReportPhotos,
} from "@/lib/body-report-photo-slots";

describe("body report photo slots", () => {
  it("sorts by createdAt then id", () => {
    const sorted = sortBodyReportPhotos([
      { id: "b", dataUrl: "side", createdAt: new Date("2026-01-02T12:00:00") },
      { id: "a", dataUrl: "front", createdAt: new Date("2026-01-01T12:00:00") },
    ]);
    expect(sorted.map((p) => p.dataUrl)).toEqual(["front", "side"]);
  });

  it("picks front (first in save order)", () => {
    const url = frontBodyReportPhotoDataUrl([
      { id: "2", dataUrl: "bok", createdAt: new Date("2026-01-01T12:00:01") },
      { id: "1", dataUrl: "przod", createdAt: new Date("2026-01-01T12:00:00") },
    ]);
    expect(url).toBe("przod");
  });
});
