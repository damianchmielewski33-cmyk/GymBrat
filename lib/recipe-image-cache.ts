/** IndexedDB — jednorazowe zablokowanie grafiki przepisu (Pollinations blob lub stały URL). */

const DB_NAME = "gymbrat-recipe-images";
const STORE = "locked";
const DB_VERSION = 1;

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
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
  });
}

export function isRecipeImageCacheSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

export async function getLockedRecipeImage(
  key: string,
): Promise<LockedRecipeImage | null> {
  if (!isRecipeImageCacheSupported() || !key) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => {
      const row = req.result as LockedRecipeImage | undefined;
      resolve(row ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function lockRecipeImageBlob(
  key: string,
  blob: Blob,
  sourceUrl: string,
): Promise<void> {
  if (!isRecipeImageCacheSupported() || !key) return;
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

export async function lockRecipeImageUrl(key: string, url: string): Promise<void> {
  if (!isRecipeImageCacheSupported() || !key) return;
  const db = await openDb();
  const row: LockedRecipeImage = {
    key,
    kind: "url",
    url,
    lockedAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(row);
  });
}
