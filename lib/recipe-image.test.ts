import { describe, expect, it } from "vitest";
import {
  buildAiRecipeImageUrl,
  enrichCatalogMealWithAiImage,
  getRecipeImage,
  RECIPE_IMAGE_FALLBACK,
} from "@/lib/recipe-image";
import { MEAL_CATALOG } from "@/lib/meal-catalog";

describe("getRecipeImage — AI", () => {
  it("w kodzie nie ma seedu przepisów", () => {
    expect(MEAL_CATALOG).toHaveLength(0);
  });

  it("buduje URL Pollinations z promptu", () => {
    const url = buildAiRecipeImageUrl({
      id: "obiad-0001-kurczak",
      title: "Kurczak z ryżem",
      imagePromptEn: "grilled chicken rice broccoli bowl",
    });
    expect(url).toContain("image.pollinations.ai");
    expect(url).toContain("grilled%20chicken");
  });

  it("imageUrl HTTPS ma pierwszeństwo", () => {
    const url = "https://cdn.example.com/meal.jpg";
    expect(getRecipeImage({ id: "meal_001", imageUrl: url })).toBe(url);
  });

  it("enrich przy imporcie ustawia AI imageUrl", () => {
    const enriched = enrichCatalogMealWithAiImage({
      id: "sniadanie-0001-owsianka",
      title: "Owsianka",
      imagePromptEn: "protein oatmeal bowl",
    });
    expect(enriched.imageUrl).toContain("image.pollinations.ai");
    expect(enriched.imagePromptEn).toBe("protein oatmeal bowl");
  });

  it("enrich nie zostawia unsplash jako finalnego imageUrl", () => {
    const enriched = enrichCatalogMealWithAiImage({
      id: "x",
      title: "Test",
      imagePromptEn: "salmon plate",
      imageUrl: "https://images.unsplash.com/photo-abc",
    });
    expect(enriched.imageUrl).toContain("image.pollinations.ai");
  });

  it("fallback nie jest Unsplash", () => {
    expect(RECIPE_IMAGE_FALLBACK).not.toContain("unsplash.com");
  });
});
