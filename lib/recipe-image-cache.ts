/** IndexedDB — cache grafiki Pollinations; przy upgrade czyścimy stare błędne wpisy. */

import { RECIPE_IMAGE_CACHE_GENERATION } from "@/lib/recipe-image";

const DB_NAME = "gymbrat-recipe-images";
const STORE = "locked";
/** Podbijaj razem z RECIPE_IMAGE_CACHE_GENERATION — czyści store. */
const DB_VERSION = 10 + RECIPE_IMAGE_CACHE_GENERATION;

export type LockedRecipeImage =
  | {
      key: string;
      kind: "blob";
      blob: Blob;
      sourceUrl: string;
      lockedAt: number;
    }
  | {
      key: string;
      kind: "url";
      url: string;
      lockedAt: number;
    };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("indexedDB"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Usuń stary store z błędnymi grafikami i utwórz pusty.
      if (db.objectStoreNames.contains(STORE)) {
        db.deleteObjectStore(STORE);
      }
      db.createObjectStore(STORE, { keyPath: "key" });
    };
  });
}

export function isRecipeImageCacheSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

/** Jednorazowe czyszczenie przy zmianie generacji (localStorage + IndexedDB). */
export async function ensureRecipeImageCacheGeneration(): Promise<void> {
  if (typeof window === "undefined") return;
  const flagKey = "gymbrat-recipe-img-gen";
  const current = String(RECIPE_IMAGE_CACHE_GENERATION);
  try {
    if (window.localStorage.getItem(flagKey) === current) return;
    if (isRecipeImageCacheSupported()) {
      await new Promise<void>((resolve, reject) => {
        const del = indexedDB.deleteDatabase(DB_NAME);
        del.onsuccess = () => resolve();
        del.onerror = () => reject(del.error ?? new Error("deleteDatabase"));
        del.onblocked = () => resolve();
      });
    }
    window.localStorage.setItem(flagKey, current);
  } catch {
    try {
      window.localStorage.setItem(flagKey, current);
    } catch {
      /* ignore */
    }
  }
}

export async function getLockedRecipeImage(
  key: string,
): Promise<LockedRecipeImage | null> {
  if (!isRecipeImageCacheSupported() || !key) return null;
  await ensureRecipeImageCacheGeneration();
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () =>
      resolve((req.result as LockedRecipeImage | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function lockRecipeImageBlob(
  key: string,
  blob: Blob,
  sourceUrl: string,
): Promise<void> {
  if (!isRecipeImageCacheSupported() || !key) return;
  await ensureRecipeImageCacheGeneration();
  const db = await openDb();
  const row: LockedRecipeImage = {
    key,
    kind: "blob",
    blob,
    sourceUrl,
    lockedAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(row);
  });
}

/** Nie blokujemy fallbacku Unsplash na stałe — tylko udane Pollinations. */
export async function lockRecipeImageUrl(_key: string, _url: string): Promise<void> {
  return;
}
