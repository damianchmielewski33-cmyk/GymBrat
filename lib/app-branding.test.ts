import { describe, expect, it } from "vitest";
import { isBrandingSlot } from "@/lib/app-branding-slots";
import { parseDataUrl } from "@/lib/app-branding-parse";

describe("app-branding", () => {
  it("akceptuje znane sloty", () => {
    expect(isBrandingSlot("logo_app")).toBe(true);
    expect(isBrandingSlot("icon_android")).toBe(true);
    expect(isBrandingSlot("nope")).toBe(false);
  });

  it("parseDataUrl akceptuje PNG base64", () => {
    const tiny =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const parsed = parseDataUrl(tiny);
    expect(parsed?.mimeType).toBe("image/png");
  });

  it("parseDataUrl akceptuje SVG bez base64 (FileReader)", () => {
    const svg = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
    );
    const parsed = parseDataUrl(svg);
    expect(parsed?.mimeType).toBe("image/svg+xml");
    expect(parsed?.dataUrl.startsWith("data:image/svg+xml;base64,")).toBe(true);
  });

  it("odrzuca nieobsługiwany MIME", () => {
    expect(parseDataUrl("data:text/plain;base64,YQ==")).toBeNull();
  });
});
