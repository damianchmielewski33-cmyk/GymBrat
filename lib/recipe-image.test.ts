import { describe, expect, it } from "vitest";
import {
  getRecipeImage,
  getRecipeImageFallback,
  resolveImagePrompt,
  recipeImageSeed,
  RECIPE_IMAGE_FALLBACK,
} from "@/lib/recipe-image";
import { MEAL_CATALOG } from "@/lib/meal-catalog";

describe("getRecipeImage", () => {
  it("przekazuje imagePrompt z JSON do Pollinations", () => {
    const prompt =
      "roasted turkey breast orange sweet potato cubes green beans plate";
    const url = getRecipeImage({
      id: "meal_004",
      title: "Indyk z Batatami",
      imagePrompt: prompt,
    });
    expect(url.startsWith("https://image.pollinations.ai/prompt/")).toBe(true);
    expect(url).toContain(encodeURIComponent(prompt));
    expect(url).toContain(`seed=${recipeImageSeed("meal_004")}`);
    expect(url).toContain("nologo=true");
  });

  it("resolveImagePrompt preferuje imagePrompt nad title", () => {
    expect(
      resolveImagePrompt({
        title: "Indyk z Batatami",
        imagePrompt: "turkey sweet potato plate",
      }),
    ).toBe("turkey sweet potato plate");
  });

  it("ten sam przepis+prompt = ten sam URL", () => {
    const a = {
      id: "meal_003",
      title: "Kurczak",
      imagePrompt: "grilled chicken breast rice broccoli plate",
    };
    expect(getRecipeImage(a)).toBe(getRecipeImage({ ...a }));
  });

  it("katalog buduje unikalne URL-e Pollinations z imagePrompt", () => {
    const urls = MEAL_CATALOG.map((m) => getRecipeImage(m));
    expect(new Set(urls).size).toBe(MEAL_CATALOG.length);
    for (const meal of MEAL_CATALOG) {
      expect(getRecipeImage(meal)).toContain(
        encodeURIComponent(resolveImagePrompt(meal).slice(0, 20)),
      );
    }
  });

  it("imageUrl omija Pollinations", () => {
    const url = "https://images.unsplash.com/photo-123?w=800";
    expect(
      getRecipeImage({
        id: "meal_001",
        imagePrompt: "oatmeal",
        imageUrl: url,
      }),
    ).toBe(url);
  });

  it("fallback Unsplash jest stały per id", () => {
    expect(getRecipeImageFallback({ id: "meal_001" })).toContain("unsplash.com");
    expect(RECIPE_IMAGE_FALLBACK).toContain("unsplash.com");
  });
});
