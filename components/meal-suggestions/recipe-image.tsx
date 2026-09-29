"use client";

import { memo, useEffect, useMemo, useState } from "react";
import {
  getRecipeImage,
  getRecipeImageFallback,
  recipeImageCacheKey,
  type RecipeImageSource,
} from "@/lib/recipe-image";
import {
  getLockedRecipeImage,
  isRecipeImageCacheSupported,
  lockRecipeImageBlob,
  lockRecipeImageUrl,
} from "@/lib/recipe-image-cache";
import { cn } from "@/lib/utils";

type RecipeImageProps = {
  recipe: RecipeImageSource;
  alt?: string;
  className?: string;
};

const inflight = new Map<string, Promise<string>>();
const MIN_BLOB_BYTES = 8_000;

async function resolveSrc(recipe: RecipeImageSource): Promise<string> {
  const cacheKey = recipeImageCacheKey(recipe);
  const pollinationsUrl = getRecipeImage(recipe);
  const fallback = getRecipeImageFallback(recipe);

  // Jawny imageUrl — bez Pollinations / cache.
  if ((recipe.imageUrl ?? "").trim()) {
    return pollinationsUrl;
  }

  if (isRecipeImageCacheSupported()) {
    try {
      const locked = await getLockedRecipeImage(cacheKey);
      if (locked?.kind === "blob") return URL.createObjectURL(locked.blob);
      if (locked?.kind === "url" && locked.url) return locked.url;
    } catch {
      /* ignore */
    }
  }

  try {
    const res = await fetch(pollinationsUrl, {
      mode: "cors",
      referrerPolicy: "no-referrer",
      cache: "force-cache",
    });
    if (!res.ok) throw new Error(`pollinations ${res.status}`);
    const blob = await res.blob();
    if (!blob.type.startsWith("image/") || blob.size < MIN_BLOB_BYTES) {
      throw new Error("invalid image");
    }
    if (isRecipeImageCacheSupported()) {
      try {
        await lockRecipeImageBlob(cacheKey, blob, pollinationsUrl);
      } catch {
        /* ignore */
      }
    }
    return URL.createObjectURL(blob);
  } catch {
    if (isRecipeImageCacheSupported()) {
      try {
        await lockRecipeImageUrl(cacheKey, fallback);
      } catch {
        /* ignore */
      }
    }
    return fallback;
  }
}

function loadSrc(recipe: RecipeImageSource): Promise<string> {
  const key = recipeImageCacheKey(recipe);
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = resolveSrc(recipe).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/**
 * Grafika z Pollinations na podstawie imagePrompt z JSON;
 * po pierwszym udanym pobraniu blokowana w cache przeglądarki.
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

  const recipeKey = useMemo(
    () =>
      recipeImageCacheKey({
        id,
        title,
        slot,
        imageUrl,
        imagePrompt,
        imagePromptEn,
      }),
    [id, title, slot, imageUrl, imagePrompt, imagePromptEn],
  );

  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    void loadSrc({
      id,
      title,
      slot,
      imageUrl,
      imagePrompt,
      imagePromptEn,
    }).then((resolved) => {
      if (cancelled) {
        if (resolved.startsWith("blob:")) URL.revokeObjectURL(resolved);
        return;
      }
      if (resolved.startsWith("blob:")) objectUrl = resolved;
      setSrc(resolved);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [recipeKey, id, title, slot, imageUrl, imagePrompt, imagePromptEn]);

  if (!src) {
    return (
      <div
        className={cn("h-full w-full animate-pulse bg-white/10", className)}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Pollinations / Unsplash / blob
    <img
      src={src}
      alt={alt ?? (title || "Posiłek")}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={cn("h-full w-full object-cover", className)}
    />
  );
});
