"use client";

import { memo, useCallback, useMemo, useState } from "react";
import {
  getRecipeImage,
  RECIPE_IMAGE_FALLBACK,
  type RecipeImageSource,
} from "@/lib/recipe-image";
import { cn } from "@/lib/utils";

type RecipeImageProps = {
  recipe: RecipeImageSource;
  alt?: string;
  className?: string;
};

/**
 * Lazy <img> z Pollinations + fallback Unsplash przy błędzie ładowania.
 */
export const RecipeImage = memo(function RecipeImage({
  recipe,
  alt,
  className,
}: RecipeImageProps) {
  const title = recipe.title ?? "";
  const imagePrompt = recipe.imagePrompt ?? "";
  const imagePromptEn = recipe.imagePromptEn ?? "";

  const src = useMemo(
    () => getRecipeImage({ title, imagePrompt, imagePromptEn }),
    [title, imagePrompt, imagePromptEn],
  );

  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;

  const onError = useCallback(() => {
    setFailedSrc(src);
  }, [src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- zewnętrzny URL Pollinations / Unsplash
    <img
      src={failed ? RECIPE_IMAGE_FALLBACK : src}
      alt={alt ?? (title || "Posiłek")}
      loading="lazy"
      decoding="async"
      onError={onError}
      className={cn("h-full w-full object-cover", className)}
    />
  );
});
