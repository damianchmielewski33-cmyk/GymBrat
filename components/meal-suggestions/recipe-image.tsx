"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getRecipeImage,
  getRecipeImageFallback,
  RECIPE_IMAGE_MISSING_REASON,
  type RecipeImageSource,
} from "@/lib/recipe-image";
import { UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

type RecipeImageProps = {
  recipe: RecipeImageSource;
  alt?: string;
  className?: string;
};

/**
 * Grafika przepisu: asset z importu JSON (Pollinations → DB).
 * Bez trwałego pliku — placeholder + console.error z powodem.
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
  const isImmediateFallback = src === fallback;

  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = isImmediateFallback || failedSrc === src;
  const loggedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!failed) return;
    const key = id || title || src;
    if (loggedRef.current === key) return;
    loggedRef.current = key;
    console.error(
      `[GymBrat] ${RECIPE_IMAGE_MISSING_REASON}`,
      {
        id: id || undefined,
        title: title || undefined,
        imageUrl: imageUrl || undefined,
        src,
      },
    );
  }, [failed, id, title, imageUrl, src]);

  const onError = useCallback(() => {
    setFailedSrc(src);
  }, [src]);

  if (failed) {
    return (
      <span
        className={cn(
          "relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#1d1a12] via-[#121212] to-[#0a0a0a]",
          className,
        )}
        role="img"
        aria-label={alt ?? (title || "Posiłek")}
      >
        <UtensilsCrossed
          className="h-7 w-7 text-[var(--gym-gold)]/50"
          aria-hidden
        />
      </span>
    );
  }

  return (
    <span className={cn("relative block h-full w-full overflow-hidden", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Pollinations AI / HTTPS */}
      <img
        src={src}
        alt={alt ?? (title || "Posiłek")}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={onError}
        className="h-full w-full object-cover"
      />
    </span>
  );
});
