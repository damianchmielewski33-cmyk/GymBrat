/** IndexedDB — kolejka zapisów treningu gdy brak sieci lub błąd połączenia. */

const DB_NAME = "gymbrat-workout-outbox";
const STORE = "pending";
const DB_VERSION = 1;

export type PendingWorkoutPayload = {
  /** Klucz idempotencji zapisu (ADR 0004 p.1) — ten sam przy każdej próbie tej sesji. */
  operationId: string;
  title: string;
  startedAt: number;
  endedAt: number;
  cardioMinutes: number;
  cardio?: {
    distanceKm?: number | null;
    avgHr?: number | null;
    calories?: number | null;
    steps?: number | null;
    paceMinPerKm?: number | null;
  } | null;
  exercises: unknown;
  workoutPlanId: string | null;
};

export type PendingWorkoutRecord = {
  id: string;
  createdAt: number;
  payload: PendingWorkoutPayload;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("indexedDB"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

export async function outboxEnqueue(payload: PendingWorkoutPayload): Promise<string> {
  const id = crypto.randomUUID();
  const db = await openDb();
  const rec: PendingWorkoutRecord = { id, createdAt: Date.now(), payload };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(rec);
  });
}

/** Zapisuje poprawiony rekord (dopisany `operationId`) z powrotem do IndexedDB. */
function outboxPut(db: IDBDatabase, rec: PendingWorkoutRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(rec);
  });
}

/**
 * Wpisy sprzed dodania idempotencji (005, defekt B-2) nie mają `operationId`;
 * serwer go dziś wymaga (Zod), więc bez tej poprawki taki wpis dostaje 400
 * w nieskończoność i nigdy nie opuszcza kolejki. Dopisujemy klucz „w locie”
 * jednorazowo przy odczycie, zamiast podbijać wersję IndexedDB i migrować —
 * to jednorazowy zapis (nie powtarzalna operacja), więc nowy klucz jest bezpieczny.
 */
export async function outboxList(): Promise<PendingWorkoutRecord[]> {
  const db = await openDb();
  const records = await new Promise<PendingWorkoutRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () =>
      resolve(Array.isArray(req.result) ? (req.result as PendingWorkoutRecord[]) : []);
    req.onerror = () => reject(req.error);
  });

  const backfilled: PendingWorkoutRecord[] = [];
  for (const rec of records) {
    if (typeof rec.payload?.operationId === "string" && rec.payload.operationId.length > 0) {
      backfilled.push(rec);
      continue;
    }
    const fixed: PendingWorkoutRecord = {
      ...rec,
      payload: { ...rec.payload, operationId: crypto.randomUUID() },
    };
    try {
      await outboxPut(db, fixed);
    } catch {
      /* jeśli zapis się nie uda, spróbujemy przy następnym odczycie */
    }
    backfilled.push(fixed);
  }
  return backfilled;
}

export async function outboxRemove(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete(id);
  });
}

export function isOutboxSupported(): boolean {
  return typeof indexedDB !== "undefined";
}
