import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 005, defekt B-2: wpisy kolejki offline zapisane przed dodaniem idempotencji nie mają
 * `operationId`. Serwer go dziś wymaga (Zod), więc bez backfillu taki wpis dostaje 400
 * w nieskończoność i nigdy nie opuszcza kolejki. `outboxList()` musi dopisać klucz
 * „w locie” przy odczycie.
 *
 * Minimalna atrapa IndexedDB (repo nie ma `fake-indexeddb`) — wystarczająca dla
 * wzorca użycia w `lib/workout-outbox-db.ts` (open / transaction / objectStore /
 * put / getAll / delete), zdarzenia dostarczane przez microtask jak w realnym IDB.
 */
function makeRequest(): {
  result: unknown;
  error: unknown;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  onupgradeneeded: (() => void) | null;
} {
  return { result: undefined, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
}

function createFakeIndexedDb() {
  const stores = new Map<string, Map<string, unknown>>();

  function getTransaction(storeName: string) {
    if (!stores.has(storeName)) stores.set(storeName, new Map());
    const map = stores.get(storeName)!;
    const tx: { oncomplete: (() => void) | null; onerror: (() => void) | null } = {
      oncomplete: null,
      onerror: null,
    };
    const store = {
      put(rec: { id: string }) {
        map.set(rec.id, rec);
        queueMicrotask(() => tx.oncomplete?.());
        return makeRequest();
      },
      getAll() {
        const req = makeRequest();
        const snapshot = Array.from(map.values());
        queueMicrotask(() => {
          req.result = snapshot;
          req.onsuccess?.();
        });
        return req;
      },
      delete(id: string) {
        map.delete(id);
        queueMicrotask(() => tx.oncomplete?.());
        return makeRequest();
      },
    };
    return { tx, store };
  }

  return {
    open(_name: string, _version: number) {
      const req = makeRequest();
      queueMicrotask(() => {
        const db = {
          objectStoreNames: { contains: (n: string) => stores.has(n) },
          createObjectStore(n: string) {
            stores.set(n, new Map());
          },
          transaction(storeName: string) {
            const { tx, store } = getTransaction(storeName);
            return Object.assign(tx, { objectStore: () => store });
          },
        };
        req.result = db;
        req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
    /** Pomoc testowa: wstrzyknięcie rekordu bez przechodzenia przez `outboxEnqueue`. */
    __seed(storeName: string, rec: { id: string } & Record<string, unknown>) {
      if (!stores.has(storeName)) stores.set(storeName, new Map());
      stores.get(storeName)!.set(rec.id, rec);
    },
  };
}

describe("workout-outbox-db: backfill operationId przy odczycie (005, B-2)", () => {
  let fakeDb: ReturnType<typeof createFakeIndexedDb>;

  beforeEach(() => {
    vi.resetModules();
    fakeDb = createFakeIndexedDb();
    vi.stubGlobal("indexedDB", fakeDb);
    vi.stubGlobal("crypto", {
      randomUUID: () => "generated-op-id",
    });
  });

  it("dopisuje operationId wpisowi zapisanemu przed tą zmianą i zwraca go z listy", async () => {
    const { outboxList } = await import("@/lib/workout-outbox-db");
    fakeDb.__seed("pending", {
      id: "rec-1",
      createdAt: 1000,
      payload: {
        title: "Stary trening",
        startedAt: 1,
        endedAt: 2,
        cardioMinutes: 0,
        exercises: [],
        workoutPlanId: null,
      },
    });

    const list = await outboxList();

    expect(list).toHaveLength(1);
    expect(list[0]!.payload.operationId).toBe("generated-op-id");
  });

  it("nie zmienia operationId wpisu, który już go ma", async () => {
    const { outboxList } = await import("@/lib/workout-outbox-db");
    fakeDb.__seed("pending", {
      id: "rec-2",
      createdAt: 1000,
      payload: {
        operationId: "already-set",
        title: "Nowy trening",
        startedAt: 1,
        endedAt: 2,
        cardioMinutes: 0,
        exercises: [],
        workoutPlanId: null,
      },
    });

    const list = await outboxList();

    expect(list[0]!.payload.operationId).toBe("already-set");
  });
});
