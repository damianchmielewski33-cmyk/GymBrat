import { describe, expect, it } from "vitest";
import { getRecipeImage, RECIPE_IMAGE_FALLBACK } from "@/lib/recipe-image";

describe("getRecipeImage", () => {
  it("buduje URL Pollinations z title", () => {
    const url = getRecipeImage({ title: "Kurczak z Ryżem i Brokułem" });
    expect(url.startsWith("https://image.pollinations.ai/prompt/")).toBe(true);
    expect(url).toContain(encodeURIComponent("Kurczak z Ryżem i Brokułem"));
    expect(url).toContain(encodeURIComponent("healthy fitness meal"));
    expect(url).toContain(encodeURIComponent("professional food photography"));
    expect(url).toContain(encodeURIComponent("realistic food"));
    expect(url).toContain(encodeURIComponent("natural lighting"));
  });

  it("preferuje imagePrompt nad title", () => {
    const url = getRecipeImage({
      title: "Kurczak z Ryżem i Brokułem",
      imagePrompt: "grilled chicken breast with rice and broccoli",
    });
    expect(url).toContain(
      encodeURIComponent("grilled chicken breast with rice and broccoli"),
    );
    expect(url).not.toContain(encodeURIComponent("Kurczak z Ryżem"));
  });

  it("używa imagePromptEn gdy brak imagePrompt", () => {
    const url = getRecipeImage({
      title: "Skyr",
      imagePromptEn: "Greek yogurt bowl berries",
    });
    expect(url).toContain(encodeURIComponent("Greek yogurt bowl berries"));
  });

  it("eksportuje stały fallback Unsplash", () => {
    expect(RECIPE_IMAGE_FALLBACK).toBe(
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200",
    );
  });
});
