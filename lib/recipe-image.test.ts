import { describe, expect, it } from "vitest";
import {
  getRecipeImage,
  getRecipeImageFallback,
  recipeImageCacheKey,
  recipeImageSeed,
  RECIPE_IMAGE_FALLBACK,
} from "@/lib/recipe-image";
import { MEAL_CATALOG } from "@/lib/meal-catalog";

describe("getRecipeImage", () => {
  it("buduje stabilny URL Pollinations z seedem", () => {
    const url = getRecipeImage({
      id: "meal_003",
      title: "Kurczak z Ryżem i Brokułem",
      imagePrompt: "grilled chicken breast rice broccoli plate",
    });
    expect(url.startsWith("https://image.pollinations.ai/prompt/")).toBe(true);
    expect(url).toContain(encodeURIComponent("grilled chicken breast rice broccoli plate"));
    expect(url).toContain(`seed=${recipeImageSeed("meal_003")}`);
    expect(url).toContain("nologo=true");
    expect(url).not.toContain("v=");
  });

  it("ten sam przepis = ten sam URL i cache key", () => {
    const a = {
      id: "meal_004",
      title: "Indyk z Batatami",
      imagePrompt: "roasted turkey breast orange sweet potato cubes green beans plate",
    };
    expect(getRecipeImage(a)).toBe(getRecipeImage({ ...a }));
    expect(recipeImageCacheKey(a)).toBe("id:meal_004");
  });

  it("generuje inny URL dla każdego przepisu w katalogu", () => {
    const urls = MEAL_CATALOG.map((m) => getRecipeImage(m));
    expect(new Set(urls).size).toBe(MEAL_CATALOG.length);
  });

  it("fallbacki Unsplash są stałe i różne per meal_00N", () => {
    expect(getRecipeImageFallback({ id: "meal_001" })).toBe(
      getRecipeImageFallback({ id: "meal_001" }),
    );
    expect(getRecipeImageFallback({ id: "meal_001" })).not.toBe(
      getRecipeImageFallback({ id: "meal_004" }),
    );
    expect(RECIPE_IMAGE_FALLBACK).toContain("unsplash.com");
  });
});
