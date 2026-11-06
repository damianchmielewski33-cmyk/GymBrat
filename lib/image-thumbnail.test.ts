import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { makeThumbnailDataUrl, thumbKeyFor } = await import("@/lib/image-thumbnail");

describe("miniatury zdjęć (Z88b)", () => {
  it("zmniejsza duży obraz do WebP ≤ 480 px", async () => {
    const png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#888" } }).png().toBuffer();
    const out = await makeThumbnailDataUrl(`data:image/png;base64,${png.toString("base64")}`);
    expect(out).toMatch(/^data:image\/webp;base64,/);
    const meta = await sharp(Buffer.from(out!.split(",")[1]!, "base64")).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBe(480);
  });
  it("zwraca null dla nie-obrazu", async () => {
    expect(await makeThumbnailDataUrl("data:text/plain;base64,AAAA")).toBeNull();
    expect(await makeThumbnailDataUrl("data:image/png;base64,AAAA")).toBeNull();
  });
  it("klucz miniatury", () => expect(thumbKeyFor("a/b")).toBe("a/b.thumb"));
});
