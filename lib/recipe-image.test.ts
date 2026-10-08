import { describe, expect, it } from "vitest";
import {
  buildAiRecipeImageUrl,
  enrichCatalogMealWithAiImage,
  getRecipeImage,
  isDurableRecipeImageUrl,
  RECIPE_IMAGE_FALLBACK,
} from "@/lib/recipe-image";
import { MEAL_CATALOG } from "@/lib/meal-catalog";

describe("getRecipeImage — trwałe grafiki katalogu", () => {
  it("w kodzie nie ma seedu przepisów", () => {
    expect(MEAL_CATALOG).toHaveLength(0);
  });

  it("buildAiRecipeImageUrl nadal buduje proxy (tylko generacja serwerowa)", () => {
    const url = buildAiRecipeImageUrl({
      id: "obiad-0001-kurczak",
      title: "Kurczak z ryżem",
      imagePromptEn: "grilled chicken rice broccoli bowl",
    });
    expect(url.startsWith("/api/recipe-image?")).toBe(true);
    expect(url).not.toContain("image.pollinations.ai");
  });

  it("imageUrl HTTPS (nie Pollinations) ma pierwszeństwo", () => {
    const url = "https://cdn.example.com/meal.jpg";
    expect(getRecipeImage({ id: "meal_001", imageUrl: url })).toBe(url);
    expect(isDurableRecipeImageUrl(url)).toBe(true);
  });

  it("trwały URL katalogu jest durable", () => {
    const url = "/api/catalog-meal-image/meal_011?v=1";
    expect(isDurableRecipeImageUrl(url)).toBe(true);
    expect(getRecipeImage({ id: "meal_011", imageUrl: url })).toBe(url);
  });

  it("legacy Pollinations / proxy nie są używane w UI (placeholder)", () => {
    expect(
      getRecipeImage({
        id: "x",
        title: "Sałatka",
        imagePromptEn: "chicken salad",
        imageUrl:
          "https://image.pollinations.ai/prompt/chicken%20salad?width=640&height=400",
      }),
    ).toBe(RECIPE_IMAGE_FALLBACK);

    expect(
      getRecipeImage({
        id: "x",
        title: "Sałatka",
        imagePromptEn: "chicken salad",
        imageUrl: "/api/recipe-image?p=chicken+salad&seed=1",
      }),
    ).toBe(RECIPE_IMAGE_FALLBACK);
  });

  it("enrich przy imporcie NIE ustawia proxy — tylko prompt", () => {
    const enriched = enrichCatalogMealWithAiImage({
      id: "sniadanie-0001-owsianka",
      title: "Owsianka",
      imagePromptEn: "protein oatmeal bowl",
    });
    expect(enriched.imageUrl).toBeUndefined();
    expect(enriched.imagePromptEn).toBe("protein oatmeal bowl");
  });

  it("enrich usuwa unsplash i legacy pollinations z imageUrl", () => {
    const enriched = enrichCatalogMealWithAiImage({
      id: "x",
      title: "Test",
      imagePromptEn: "salmon plate",
      imageUrl: "https://images.unsplash.com/photo-abc",
    });
    expect(enriched.imageUrl).toBeUndefined();
    expect(enriched.imagePromptEn).toBe("salmon plate");
  });

  it("enrich zachowuje trwały URL katalogu", () => {
    const url = "/api/catalog-meal-image/meal_x?v=99";
    const enriched = enrichCatalogMealWithAiImage({
      id: "meal_x",
      title: "Test",
      imagePromptEn: "bowl",
      imageUrl: url,
    });
    expect(enriched.imageUrl).toBe(url);
  });

  it("fallback nie jest Unsplash", () => {
    expect(RECIPE_IMAGE_FALLBACK).not.toContain("unsplash.com");
  });
});
