"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getRecipeImage,
  getRecipeImageFallback,
  RECIPE_IMAGE_MISSING_REASON,
  type RecipeImageSource,
} from "@/lib/recipe-image";
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

  return (
    <span className={cn("relative block h-full w-full overflow-hidden", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Pollinations AI / HTTPS */}
      <img
        src={failed ? fallback : src}
        alt={alt ?? (title || "Posiłek")}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={onError}
        className="h-full w-full object-cover"
      />
      {failed ? (
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-2 pb-2 pt-8 text-center"
          role="status"
        >
          <span className="block text-[10px] font-semibold leading-snug text-[var(--gym-gold)] sm:text-[11px]">
            Brak grafiki AI
          </span>
          <span className="mt-0.5 block text-[9px] leading-snug text-white/55 sm:text-[10px]">
            Import JSON wymaga POLLINATIONS_API_KEY
          </span>
        </span>
      ) : null}
    </span>
  );
});
