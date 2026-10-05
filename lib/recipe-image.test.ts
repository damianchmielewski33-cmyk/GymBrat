import { describe, expect, it } from "vitest";
import {
  buildAiRecipeImageUrl,
  enrichCatalogMealWithAiImage,
  getRecipeImage,
  RECIPE_IMAGE_FALLBACK,
} from "@/lib/recipe-image";
import { MEAL_CATALOG } from "@/lib/meal-catalog";

describe("getRecipeImage — AI proxy", () => {
  it("w kodzie nie ma seedu przepisów", () => {
    expect(MEAL_CATALOG).toHaveLength(0);
  });

  it("buduje URL proxy /api/recipe-image (nie legacy image.pollinations.ai)", () => {
    const url = buildAiRecipeImageUrl({
      id: "obiad-0001-kurczak",
      title: "Kurczak z ryżem",
      imagePromptEn: "grilled chicken rice broccoli bowl",
    });
    expect(url.startsWith("/api/recipe-image?")).toBe(true);
    expect(url).toContain("grilled");
    expect(url).not.toContain("image.pollinations.ai");
  });

  it("imageUrl HTTPS (nie Pollinations) ma pierwszeństwo", () => {
    const url = "https://cdn.example.com/meal.jpg";
    expect(getRecipeImage({ id: "meal_001", imageUrl: url })).toBe(url);
  });

  it("legacy Pollinations imageUrl jest przebudowywany na proxy", () => {
    const url = getRecipeImage({
      id: "x",
      title: "Sałatka",
      imagePromptEn: "chicken salad",
      imageUrl:
        "https://image.pollinations.ai/prompt/chicken%20salad?width=640&height=400",
    });
    expect(url.startsWith("/api/recipe-image?")).toBe(true);
  });

  it("enrich przy imporcie ustawia proxy imageUrl", () => {
    const enriched = enrichCatalogMealWithAiImage({
      id: "sniadanie-0001-owsianka",
      title: "Owsianka",
      imagePromptEn: "protein oatmeal bowl",
    });
    expect(enriched.imageUrl).toContain("/api/recipe-image?");
    expect(enriched.imagePromptEn).toBe("protein oatmeal bowl");
  });

  it("enrich nie zostawia unsplash ani legacy pollinations", () => {
    const enriched = enrichCatalogMealWithAiImage({
      id: "x",
      title: "Test",
      imagePromptEn: "salmon plate",
      imageUrl: "https://images.unsplash.com/photo-abc",
    });
    expect(enriched.imageUrl).toContain("/api/recipe-image?");
  });

  it("fallback nie jest Unsplash", () => {
    expect(RECIPE_IMAGE_FALLBACK).not.toContain("unsplash.com");
  });
});
