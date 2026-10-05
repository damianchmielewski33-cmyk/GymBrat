"use client";

import { memo, useCallback, useMemo, useState } from "react";
import {
  getRecipeImage,
  getRecipeImageFallback,
  type RecipeImageSource,
} from "@/lib/recipe-image";
import { cn } from "@/lib/utils";

type RecipeImageProps = {
  recipe: RecipeImageSource;
  alt?: string;
  className?: string;
};

/**
 * Grafika przepisu: AI (Pollinations) z imageUrl / imagePromptEn zapisanych przy imporcie JSON.
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

  const fallback = useMemo(() => getRecipeImageFallback(), []);

  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;

  const onError = useCallback(() => {
    setFailedSrc(src);
  }, [src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Pollinations AI / HTTPS
    <img
      src={failed ? fallback : src}
      alt={alt ?? (title || "Posiłek")}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={onError}
      className={cn("h-full w-full object-cover", className)}
    />
  );
});
