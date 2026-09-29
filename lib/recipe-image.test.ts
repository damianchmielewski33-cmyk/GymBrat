import { describe, expect, it } from "vitest";
import {
  getRecipeImage,
  DISH_IMAGES,
  STABLE_RECIPE_IMAGES,
  RECIPE_IMAGE_FALLBACK,
} from "@/lib/recipe-image";
import { MEAL_CATALOG } from "@/lib/meal-catalog";

describe("getRecipeImage — dopasowanie do dania", () => {
  it("znane id → stała grafika katalogu", () => {
    expect(getRecipeImage({ id: "meal_003", title: "X" })).toBe(
      STABLE_RECIPE_IMAGES.meal_003,
    );
  });

  it("wrap wygrywa przed indyk (kolejność reguł)", () => {
    expect(getRecipeImage({ title: "Wrap z Indykiem i Awokado" })).toBe(
      DISH_IMAGES.wrap,
    );
  });

  it("wołowina nie dostaje deseru / owsianki", () => {
    const url = getRecipeImage({ title: "Wołowina z Kaszą i Warzywami" });
    expect(url).toBe(DISH_IMAGES.beefPlate);
    expect(url).not.toBe(DISH_IMAGES.cottageFruit);
    expect(url).not.toBe(DISH_IMAGES.oatmeal);
  });

  it("curry kurczak → curry, nie wrap", () => {
    expect(getRecipeImage({ title: "Kurczak Curry z Ryżem" })).toBe(
      DISH_IMAGES.chickenCurry,
    );
  });

  it("makaron z kurczakiem → pasta", () => {
    expect(getRecipeImage({ title: "Makaron Proteinowy z Kurczakiem" })).toBe(
      DISH_IMAGES.pastaChicken,
    );
  });

  it("imagePrompt nie nadpisuje tytułu (żeby nie podmienić dania)", () => {
    const url = getRecipeImage({
      title: "Wołowina z Kaszą i Warzywami",
      imagePrompt: "cottage cheese with strawberries and almonds",
    });
    expect(url).toBe(DISH_IMAGES.beefPlate);
  });

  it("katalog seed jest pusty (przepisy z panelu)", () => {
    expect(MEAL_CATALOG).toHaveLength(0);
  });

  it("wrap / wołowina / curry mają różne grafiki", () => {
    expect(getRecipeImage({ title: "Wrap z Indykiem i Awokado" })).toBe(DISH_IMAGES.wrap);
    expect(getRecipeImage({ title: "Wołowina z Kaszą i Warzywami" })).toBe(
      DISH_IMAGES.beefPlate,
    );
    expect(getRecipeImage({ title: "Kurczak Curry z Ryżem" })).toBe(
      DISH_IMAGES.chickenCurry,
    );
  });

  it("imageUrl ma pierwszeństwo", () => {
    const url = "https://images.unsplash.com/photo-abc?w=800";
    expect(getRecipeImage({ id: "meal_001", imageUrl: url })).toBe(url);
  });

  it("fallback istnieje", () => {
    expect(RECIPE_IMAGE_FALLBACK).toContain("unsplash.com");
  });
});
