import { describe, expect, it } from "vitest";
import { isAllowedYoutubeUrl, normalizeYoutubeUrl } from "@/lib/youtube-url";

describe("youtube-url", () => {
  it("akceptuje typowe linki YouTube", () => {
    expect(isAllowedYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isAllowedYoutubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(isAllowedYoutubeUrl("https://youtube.com/shorts/abc123XYZ01")).toBe(true);
  });

  it("odrzuca obce domeny", () => {
    expect(isAllowedYoutubeUrl("https://vimeo.com/123")).toBe(false);
    expect(isAllowedYoutubeUrl("https://evil.com/?u=youtube.com")).toBe(false);
  });

  it("normalizuje do https", () => {
    expect(normalizeYoutubeUrl("youtu.be/dQw4w9WgXcQ")).toBe(
      "https://youtu.be/dQw4w9WgXcQ",
    );
    expect(normalizeYoutubeUrl("")).toBeNull();
    expect(normalizeYoutubeUrl("https://example.com")).toBeNull();
  });
});
