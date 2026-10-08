import { describe, expect, it } from "vitest";
import {
  buildAppRecipeImageProxyUrl,
  buildPollinationsGenImageUrl,
  clampPollinationsSeed,
  composeFoodImagePrompt,
  snapPollinationsSize,
} from "@/lib/pollinations-image";

describe("pollinations-image", () => {
  it("clampuje seed do zakresu Pollinations", () => {
    expect(clampPollinationsSeed(644658340)).toBe(644658340);
    expect(clampPollinationsSeed(-5)).toBe(0);
    expect(clampPollinationsSeed(3_000_000_000)).toBe(2_147_483_647);
    expect(clampPollinationsSeed(Number.NaN)).toBe(1);
  });

  it("buduje GET URL z modelem i opcjonalnym key", () => {
    const url = buildPollinationsGenImageUrl({
      prompt: "omelette",
      seed: 1,
      width: 640,
      height: 400,
      model: "zimage",
      apiKey: "sk_test",
    });
    expect(url).toContain("https://gen.pollinations.ai/image/");
    expect(url).toContain("model=zimage");
    expect(url).toContain("width=512");
    expect(url).toContain("height=512");
    expect(url).toContain("key=sk_test");
  });

  it("snapPollinationsSize mapuje kartę 640x400 do 512 (szybkość)", () => {
    expect(snapPollinationsSize(640, 400)).toEqual({ width: 512, height: 512 });
    expect(snapPollinationsSize(1024, 768)).toEqual({ width: 768, height: 512 });
  });

  it("proxy app nie ujawnia klucza", () => {
    const url = buildAppRecipeImageProxyUrl({
      prompt: "omelette spinach",
      title: "Omlet",
      seed: 1,
    });
    expect(url.startsWith("/api/recipe-image?")).toBe(true);
    expect(url).not.toContain("sk_");
    expect(url).toContain("title=Omlet");
  });

  it("composeFoodImagePrompt jest zwięzły", () => {
    const p = composeFoodImagePrompt({
      title: "Omlet",
      prompt: "egg white omelette",
    });
    expect(p).toContain("Dish: Omlet");
    expect(p).toContain("egg white omelette");
    expect(p.length).toBeLessThan(400);
  });
});
