/**
 * Symulacja sterowania synchronizacją w `components/active-workout/active-workout-cloud-sync.tsx`
 * po poprawkach P1/P2 (etap 9, powtórka). Uruchomienie z korzenia repo:
 *   npx tsx docs/wydajnosc/005-koniec-treningu-sim-push.ts
 *
 * Co jest REPLIKĄ (1:1 z logiką efektów, `active-workout-cloud-sync.tsx` po poprawce sekcji 10):
 * gate `authenticated` (P1), `push()` z flagami `pushingRef`/`pendingChangeRef`/`clearedPushedRef`,
 * `scheduleRetry` (backoff z `computeSyncRetryDelayMs`, 401/403 bez ponowienia + `pausedAuthRef`),
 * `waitForOnline` z deduplikacją (`waitingOnlineRef`, R-3), tick `setInterval` 8 s, który POMIJA
 * `push()` przy zaplanowanym ponowieniu, oczekiwaniu na `online` LUB `pausedAuthRef` (P2/P1-R-1),
 * gałąź DELETE z `catch` (R-4), `setTimeout` ponowienia. `pausedAuthRef` resetowany przy
 * (re)starcie efektu z `authenticated: true` (replika resetu przy zmianie `false`→`true`).
 * Co jest PRAWDZIWE: `deleteCloud`/`putCloud`/`readRevision`/`writeRevision`
 * (`lib/active-workout-cloud-client.ts`), `computeSyncRetryDelayMs`/`isAuthErrorStatus`/
 * `isLikelyOfflineError` (`lib/active-workout-sync-backoff.ts`), `hasActiveLocalSession`.
 * Co jest PODMIENIONE: zegar wirtualny (10 min symulacji w ułamki sekund), `setTimeout`/
 * `setInterval`, `navigator.onLine`, `localStorage` (Map), `fetch` (atrapa odpowiedzi serwera),
 * listenery `online` (zliczane, odpalane przy zdarzeniu). Brak DOM/React (brak jsdom w repo).
 *
 * Każdy scenariusz liczy żądania HTTP w oknie 600 s symulowanego czasu.
 */
import {
  deleteCloud,
  putCloud,
  readRevision,
  writeRevision,
} from "../../lib/active-workout-cloud-client";
import {
  hasActiveLocalSession,
  type ActiveWorkoutCloudPayload,
} from "../../lib/active-workout-cloud";
import {
  computeSyncRetryDelayMs,
  isAuthErrorStatus,
  isLikelyOfflineError,
} from "../../lib/active-workout-sync-backoff";

const PUSH_INTERVAL_MS = 8_000;
const WINDOW_MS = 600_000;
const realSetImmediate = globalThis.setImmediate;
/** Nieobsłużone odrzucenia `void push()` (w przeglądarce: "Uncaught (in promise)"). */
let unhandledRejections = 0;
process.on("unhandledRejection", () => {
  unhandledRejections += 1;
});

type Reply = { status: number; body: unknown; retryAfterSec?: number } | "reject";

const EMPTY_PAYLOAD = {
  startedAt: null,
  pausedElapsedSeconds: 0,
  workoutStartedAtMs: null,
  title: "",
  workoutPlanId: null,
  cardioMinutes: 0,
  cardioExtras: null,
  exercises: [],
  selectedExerciseId: null,
} as unknown as ActiveWorkoutCloudPayload;

const ACTIVE_PAYLOAD = {
  startedAt: 1_760_000_000_000,
  pausedElapsedSeconds: 0,
  workoutStartedAtMs: 1_760_000_000_000,
  title: "Trening",
  workoutPlanId: "plan-1",
  cardioMinutes: 0,
  cardioExtras: null,
  exercises: [{ id: "e1", name: "Wyciskanie", sets: [{ reps: 8, weight: 60, done: true }] }],
  selectedExerciseId: null,
} as unknown as ActiveWorkoutCloudPayload;

// ---- Zegar wirtualny ----------------------------------------------------------
type Timer = { id: number; at: number; every: number | null; fn: () => void };
let clock = 0;
let timers: Timer[] = [];
let timerSeq = 1;
let onlineListeners: Array<() => void> = [];
let online = true;
let requests = { total: 0, get: 0, put: 0, del: 0 };
let responder: (method: string, n: number) => Reply = () => ({ status: 200, body: {} });

function addTimer(fn: () => void, delay: number, every: number | null): number {
  const t: Timer = { id: timerSeq++, at: clock + delay, every, fn };
  timers.push(t);
  return t.id;
}
function removeTimer(id: number | null | undefined): void {
  if (id == null) return;
  timers = timers.filter((t) => t.id !== id);
}
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise<void>((r) => realSetImmediate(() => r()));
}
async function advanceTo(untilMs: number): Promise<void> {
  for (;;) {
    timers.sort((a, b) => a.at - b.at || a.id - b.id);
    const next = timers[0];
    if (!next || next.at > untilMs) break;
    clock = next.at;
    if (next.every != null) next.at += next.every;
    else timers = timers.filter((t) => t.id !== next.id);
    next.fn();
    await flush();
  }
  clock = untilMs;
}

// ---- Atrapy przeglądarki ------------------------------------------------------
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
} as unknown as Storage;
Object.defineProperty(globalThis, "navigator", {
  value: { get onLine() { return online; } },
  configurable: true,
});

globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
  const url = String(input);
  if (url.includes("/api/csrf")) return new Response("{}", { status: 200 });
  const method = String(init?.method ?? "GET");
  requests.total += 1;
  if (method === "GET") requests.get += 1;
  else if (method === "PUT") requests.put += 1;
  else if (method === "DELETE") requests.del += 1;
  const reply = responder(method, requests.total);
  if (reply === "reject") throw new TypeError("Failed to fetch");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (reply.retryAfterSec != null) headers["Retry-After"] = String(reply.retryAfterSec);
  return new Response(JSON.stringify(reply.body), { status: reply.status, headers });
}) as typeof fetch;

// ---- Replika efektu ActiveWorkoutCloudSync ------------------------------------
type Sync = {
  start(): void;
  stop(): void;
  hydrated: boolean;
  active: boolean;
};

function createSync(opts: { authenticated: boolean; active: boolean }): Sync {
  const refs = {
    hydrated: false,
    unmounted: false,
    pushing: false,
    pendingChange: false,
    cleared: false,
    retryAttempt: 0,
    retryTimeout: null as number | null,
    waitingOnline: false,
    interval: null as number | null,
    pausedAuth: false,
  };
  const sync: Sync = {
    hydrated: false,
    active: opts.active,
    start() {
      // P1: efekt bez sesji nie startuje nic (linia 171-178 komponentu).
      if (!opts.authenticated) return;
      // Sekcja 10: sesja znów potwierdzona (start/restart efektu z `authenticated: true`)
      // odblokowuje ewentualną pauzę 401/403 z poprzedniego montażu (P1, R-1).
      refs.pausedAuth = false;
      refs.hydrated = true;
      sync.hydrated = true;
      // P2/P1-R-1: tick pomija push, gdy ponowienie zaplanowane, czekamy na `online`,
      // albo jesteśmy wstrzymani po 401/403 (komponent, setInterval).
      refs.interval = addTimer(() => {
        if (refs.retryTimeout != null || refs.waitingOnline || refs.pausedAuth) return;
        void push();
      }, PUSH_INTERVAL_MS, PUSH_INTERVAL_MS);
    },
    stop() {
      refs.unmounted = true;
      removeTimer(refs.interval);
      removeTimer(refs.retryTimeout);
    },
  };

  const clearRetry = () => {
    removeTimer(refs.retryTimeout);
    refs.retryTimeout = null;
  };

  const scheduleRetry = (status?: number, retryAfterSec?: number | null) => {
    if (refs.unmounted) return;
    if (isAuthErrorStatus(status)) {
      refs.retryAttempt = 0;
      refs.pausedAuth = true;
      return;
    }
    refs.retryAttempt += 1;
    const delay = computeSyncRetryDelayMs({ attempt: refs.retryAttempt, retryAfterSec });
    clearRetry();
    refs.retryTimeout = addTimer(() => {
      refs.retryTimeout = null;
      void push();
    }, delay, null);
  };

  // R-3: jeden nasłuchiwacz (flaga), nie kolejny przy każdym błędzie.
  const waitForOnline = () => {
    if (refs.unmounted) return;
    if (refs.waitingOnline) return;
    refs.waitingOnline = true;
    onlineListeners.push(() => {
      refs.waitingOnline = false;
      if (!refs.unmounted) void push();
    });
  };

  const push = async (): Promise<void> => {
    if (!refs.hydrated || refs.unmounted || refs.pausedAuth) return;
    if (refs.pushing) {
      refs.pendingChange = true;
      return;
    }
    const payload = sync.active ? ACTIVE_PAYLOAD : EMPTY_PAYLOAD;

    if (!hasActiveLocalSession(payload)) {
      if (refs.cleared) return;
      refs.cleared = true;
      refs.pushing = true;
      try {
        const result = await deleteCloud(readRevision());
        if (!result.ok && !result.conflict) {
          refs.cleared = false;
          scheduleRetry(result.status, result.retryAfterSec);
        } else if (result.conflict) {
          writeRevision(result.conflict.revision);
          refs.retryAttempt = 0;
        } else if (result.ok && result.revision != null) {
          writeRevision(result.revision);
          refs.retryAttempt = 0;
        }
      } catch {
        // R-4: wyjątek DELETE (brak sieci) — reset wartownika, ponowienie przez online/backoff.
        refs.cleared = false;
        if (isLikelyOfflineError()) waitForOnline();
        else scheduleRetry();
      } finally {
        refs.pushing = false;
        if (refs.pendingChange) {
          refs.pendingChange = false;
          void push();
        }
      }
      return;
    }
    refs.cleared = false;
    refs.pushing = true;
    refs.pendingChange = false;
    try {
      const result = await putCloud(payload, readRevision(), "device-sim-0001", undefined);
      if (result.conflict) {
        refs.retryAttempt = 0;
      } else if (result.ok && result.revision != null) {
        writeRevision(result.revision);
        refs.retryAttempt = 0;
      } else if (!result.ok) {
        scheduleRetry(result.status, result.retryAfterSec);
      }
    } catch {
      if (isLikelyOfflineError()) waitForOnline();
      else scheduleRetry();
    } finally {
      refs.pushing = false;
      if (refs.pendingChange) {
        refs.pendingChange = false;
        void push();
      }
    }
  };

  return sync;
}

// ---- Scenariusze --------------------------------------------------------------
type Result = {
  name: string;
  requests: number;
  get: number;
  put: number;
  del: number;
  perMin: number;
  extra: string;
  expected: string;
};

async function scenario(
  name: string,
  cfg: { authenticated: boolean; active: boolean; respond: (m: string, n: number) => Reply },
  expected: string,
  extra?: () => string,
  durationMs = WINDOW_MS,
): Promise<Result> {
  timers = [];
  onlineListeners = [];
  online = true;
  requests = { total: 0, get: 0, put: 0, del: 0 };
  unhandledRejections = 0;
  store.clear();
  clock = 0;
  responder = cfg.respond;
  const sync = createSync({ authenticated: cfg.authenticated, active: cfg.active });
  sync.start();
  await advanceTo(durationMs);
  const perMin = requests.total / (durationMs / 60_000);
  return {
    name,
    requests: requests.total,
    get: requests.get,
    put: requests.put,
    del: requests.del,
    perMin,
    extra: `Nieobsłużone odrzucenia: ${unhandledRejections}` + (extra ? ` ${extra()}` : ""),
    expected,
  };
}

function fmt(r: Result): string {
  return [
    r.name,
    `  żądań w 10 min: ${r.requests} (GET ${r.get}, PUT ${r.put}, DELETE ${r.del}), ${r.perMin.toFixed(1)} żąd./min`,
    r.extra ? `  ${r.extra}` : "",
    `  oczekiwane: ${r.expected}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function main() {
  const out: Result[] = [];

  out.push(
    await scenario(
      "A. Gość (status unauthenticated), otwarta karta 10 min",
      { authenticated: false, active: false, respond: () => ({ status: 401, body: { ok: false } }) },
      "0 żądań (P1: efekt nie startuje bez sesji).",
    ),
  );

  out.push(
    await scenario(
      "A2. Zalogowany po stronie klienta, sesja wygasła na serwerze, bez sesji lokalnej: DELETE -> 401",
      { authenticated: true, active: false, respond: () => ({ status: 401, body: { ok: false } }) },
      "1 żądanie (R-1 zamknięte): pierwszy tick dostaje 401, ustawia `pausedAuthRef`, kolejne ticki są pomijane do zmiany `authenticated`.",
    ),
  );

  out.push(
    await scenario(
      "A3. Zalogowany, sesja aktywna, PUT -> 401 (sesja wygasła w trakcie)",
      { authenticated: true, active: true, respond: () => ({ status: 401, body: { ok: false } }) },
      "Jak A2: 1 żądanie, reszta ticków wstrzymana przez `pausedAuthRef` (R-1 zamknięte).",
    ),
  );

  out.push(
    await scenario(
      "B. Aktywna sesja, PUT -> 429 z Retry-After 60 s (limit 90/min na IP)",
      {
        authenticated: true,
        active: true,
        respond: () => ({ status: 429, body: { ok: false }, retryAfterSec: 60 }),
      },
      "Backoff z Retry-After (60 s) powinien dać ~1 żądanie/min. Oczekiwanie NIE jest spełnione (R-2).",
      undefined,
    ),
  );

  out.push(
    await scenario(
      "C. Aktywna sesja, PUT -> 500 (bez Retry-After)",
      { authenticated: true, active: true, respond: () => ({ status: 500, body: { ok: false } }) },
      "Backoff 8/16/32/60 s: ~1 żądanie/min po stabilizacji. Oczekiwanie NIE jest spełnione (R-2).",
    ),
  );

  // D. Offline: fetch odrzucany, navigator.onLine === false przez całe 10 min.
  online = false;
  const offlineResult = await (async () => {
    timers = [];
    onlineListeners = [];
    requests = { total: 0, get: 0, put: 0, del: 0 };
    store.clear();
    clock = 0;
    responder = () => "reject";
    online = false;
    const sync = createSync({ authenticated: true, active: true });
    sync.start();
    await advanceTo(WINDOW_MS);
    const listenersBefore = onlineListeners.length;
    const reqs = requests.total;
    // powrót sieci: zdarzenie `online`
    online = true;
    responder = () => ({ status: 200, body: { ok: true, revision: 1, updatedAt: 0 } });
    for (const l of onlineListeners.splice(0)) l();
    await flush();
    await advanceTo(WINDOW_MS + 16_000);
    return { listenersBefore, reqs, afterOnline: requests.total - reqs, listenersAfter: onlineListeners.length };
  })();
  out.push({
    name: "D. Aktywna sesja, brak sieci 10 min, potem `online`",
    requests: offlineResult.reqs,
    get: 0,
    put: offlineResult.reqs,
    del: 0,
    perMin: offlineResult.reqs / 10,
    extra:
      `Nasłuchiwaczy "online" po 10 min offline: ${offlineResult.listenersBefore} (deduplikacja R-3). ` +
      `Po zdarzeniu "online": ${offlineResult.afterOnline} żądań PUT (oczekiwane ~1-2 + ticki).`,
    expected:
      "Przy braku sieci: bez pętli żądań (fetch nie idzie w sieć, ale wywołania są). Lista `online` nie powinna rosnąć bez końca (R-3).",
  });

  out.push(
    await scenario(
      "E. Kontrola: aktywna sesja, PUT -> 200, 10 min",
      {
        authenticated: true,
        active: true,
        respond: () => ({ status: 200, body: { ok: true, revision: 1, updatedAt: 0 } }),
      },
      "~75 PUT/10 min (interwał 8 s). Zgodne z P3 (nieodchudzone, bez wykrywania zmian).",
    ),
  );

  out.push(
    await scenario(
      "F. Zalogowany bez sesji, DELETE -> 200, 10 min",
      {
        authenticated: true,
        active: false,
        respond: () => ({ status: 200, body: { ok: true, revision: 0 } }),
      },
      "1 DELETE na całą sesję karty (wartownik clearedPushedRef), potem 0.",
    ),
  );

  out.push(
    await scenario(
      "G. Sesja zakończona offline: DELETE rzuca (brak sieci), 10 min, potem sieć wraca",
      {
        authenticated: true,
        active: false,
        respond: (_m, n) => (n === 1 ? "reject" : { status: 200, body: { ok: true, revision: 0 } }),
      },
      "Oczekiwane: DELETE ponowiony po powrocie sieci (wygaszenie w chmurze). Obecnie: 1 próba i brak ponowienia (R-4).",
    ),
  );

  // G2. Sesja zakończona offline (navigator.onLine === false): DELETE rzuca, potem `online`.
  const offlineDelete = await (async () => {
    timers = [];
    onlineListeners = [];
    requests = { total: 0, get: 0, put: 0, del: 0 };
    store.clear();
    clock = 0;
    online = false;
    responder = () => "reject";
    const sync = createSync({ authenticated: true, active: false });
    sync.start();
    await advanceTo(WINDOW_MS);
    const reqsOffline = requests.total;
    online = true;
    responder = () => ({ status: 200, body: { ok: true, revision: 0 } });
    for (const l of onlineListeners.splice(0)) l();
    await flush();
    await advanceTo(WINDOW_MS + 16_000);
    return { reqsOffline, afterOnline: requests.total - reqsOffline };
  })();
  out.push({
    name: "G2. Sesja zakończona offline, DELETE rzuca przy online=false, 10 min, potem `online`",
    requests: requests.total,
    get: 0,
    put: 0,
    del: requests.total,
    perMin: offlineDelete.reqsOffline / 10,
    extra: `Żądań w fazie offline: ${offlineDelete.reqsOffline}. Po zdarzeniu online: ${offlineDelete.afterOnline} DELETE.`,
    expected: "1 próba offline (reszta blokowana przez waitingOnline), po zdarzeniu online 1 DELETE ponowiony.",
  });

  for (const r of out) console.log(fmt(r) + "\n");
}

void main();
