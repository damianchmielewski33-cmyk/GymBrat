import { describe, expect, it } from "vitest";
import {
  getRecipeImage,
  recipeImageSeed,
  RECIPE_IMAGE_FALLBACK,
} from "@/lib/recipe-image";

describe("getRecipeImage", () => {
  it("buduje URL Pollinations z title i parametrami", () => {
    const url = getRecipeImage({ title: "Kurczak z Ryżem i Brokułem" });
    expect(url.startsWith("https://image.pollinations.ai/prompt/")).toBe(true);
    expect(url).toContain(encodeURIComponent("Kurczak z Ryżem i Brokułem"));
    expect(url).toContain(encodeURIComponent("professional food photography"));
    expect(url).toContain("nologo=true");
    expect(url).toContain("width=640");
  });

  it("preferuje imagePrompt i dołącza tytuł dla precyzji", () => {
    const url = getRecipeImage({
      id: "meal_003",
      title: "Kurczak z Ryżem i Brokułem",
      imagePrompt: "grilled chicken breast fillet, white rice, steamed broccoli",
    });
    expect(url).toContain(
      encodeURIComponent("grilled chicken breast fillet, white rice, steamed broccoli"),
    );
    expect(url).toContain(encodeURIComponent("Kurczak z Ryżem i Brokułem"));
    expect(url).toContain(`seed=${recipeImageSeed("meal_003")}`);
  });

  it("używa imagePromptEn gdy brak imagePrompt", () => {
    const url = getRecipeImage({
      title: "Skyr",
      imagePromptEn: "Greek yogurt bowl berries",
    });
    expect(url).toContain(encodeURIComponent("Greek yogurt bowl berries"));
  });

  it("dla indyka z batatami wymusza konkretne składniki w prompcie", () => {
    const url = getRecipeImage({
      id: "meal_004",
      title: "Indyk z Batatami",
      imagePrompt:
        "sliced roasted turkey breast, roasted orange sweet potato cubes, steamed green beans on a white plate",
    });
    expect(url).toContain(encodeURIComponent("turkey breast"));
    expect(url).toContain(encodeURIComponent("sweet potato"));
    expect(url).toContain(encodeURIComponent("do not replace the dish"));
  });

  it("eksportuje stały fallback Unsplash", () => {
    expect(RECIPE_IMAGE_FALLBACK).toBe(
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200",
    );
  });
});
