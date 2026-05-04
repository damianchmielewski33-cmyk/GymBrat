/** IndexedDB — kolejka zapisów treningu gdy brak sieci lub błąd połączenia. */

const DB_NAME = "gymbrat-workout-outbox";
const STORE = "pending";
const DB_VERSION = 1;

export type PendingWorkoutPayload = {
  title: string;
  startedAt: number;
  endedAt: number;
  cardioMinutes: number;
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

export async function outboxList(): Promise<PendingWorkoutRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () =>
      resolve(Array.isArray(req.result) ? (req.result as PendingWorkoutRecord[]) : []);
    req.onerror = () => reject(req.error);
  });
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
