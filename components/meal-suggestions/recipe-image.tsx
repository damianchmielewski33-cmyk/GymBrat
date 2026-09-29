"use client";

import { memo, useCallback, useMemo, useState } from "react";
import {
  getRecipeImage,
  getRecipeImageFallback,
  getRecipeImageProvider,
  type RecipeImageSource,
} from "@/lib/recipe-image";
import { cn } from "@/lib/utils";

type RecipeImageProps = {
  recipe: RecipeImageSource;
  alt?: string;
  className?: string;
};

/**
 * Grafika przepisu: domyślnie stock dobrany po imagePrompt (trafny).
 * Pollinations tylko gdy włączony provider — z fallbackiem stock.
 */
export const RecipeImage = memo(function RecipeImage({
  recipe,
  alt,
  className,
}: RecipeImageProps) {
  const id = recipe.id ?? "";
  const title = recipe.title ?? "";
  const slot = recipe.slot ?? "";
  const imageUrl = recipe.imageUrl ?? "";
  const imagePrompt = recipe.imagePrompt ?? "";
  const imagePromptEn = recipe.imagePromptEn ?? "";

  const src = useMemo(
    () =>
      getRecipeImage({
        id,
        title,
        slot,
        imageUrl,
        imagePrompt,
        imagePromptEn,
      }),
    [id, title, slot, imageUrl, imagePrompt, imagePromptEn],
  );

  const fallback = useMemo(
    () =>
      getRecipeImageFallback({
        id,
        title,
        slot,
        imagePrompt,
        imagePromptEn,
      }),
    [id, title, slot, imagePrompt, imagePromptEn],
  );

  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;
  const usePollinations = getRecipeImageProvider() === "pollinations";

  const onError = useCallback(() => {
    setFailedSrc(src);
  }, [src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Unsplash / Pollinations
    <img
      src={failed ? fallback : src}
      alt={alt ?? (title || "Posiłek")}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={usePollinations || Boolean(imageUrl) ? onError : undefined}
      className={cn("h-full w-full object-cover", className)}
    />
  );
});
