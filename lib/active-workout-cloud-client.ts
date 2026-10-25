/**
 * Klient chmury aktywnej sesji (`/api/active-workout-session`) — logika fetch +
 * mapowanie odpowiedzi, wydzielona z `components/active-workout/active-workout-cloud-sync.tsx`
 * (ADR 0004 p.12, zalecenie testera sekcja 9.8 "B-1 (test)") tak, żeby dało się ją
 * testować bez DOM. Next 16 nie wymaga, by moduł pomocniczy używany WYŁĄCZNIE przez
 * komponent kliencki miał własny znacznik `"use client"` — potrzebny jest tylko w
 * pliku komponentu, nie w czystych funkcjach, które on importuje.
 */
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import {
  hasActiveLocalSession,
  type ActiveWorkoutCloudPayload,
  type ActiveWorkoutCloudRecord,
} from "@/lib/active-workout-cloud";
import { EMPTY_CARDIO_EXTRAS } from "@/lib/cardio-utils";
import { persistActiveWorkoutLocalNow } from "@/lib/active-workout-persist";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";

export const ACTIVE_SESSION_REVISION_KEY = "gymbrat:activeSessionRevision";

export function readRevision(): number {
  try {
    const n = Number(localStorage.getItem(ACTIVE_SESSION_REVISION_KEY) ?? "0");
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function writeRevision(n: number): void {
  try {
    localStorage.setItem(ACTIVE_SESSION_REVISION_KEY, String(n));
  } catch {
    /* ignore */
  }
}

export function applyCloudPayload(payload: ActiveWorkoutCloudPayload): void {
  useActiveWorkoutStore.setState({
    startedAt: payload.startedAt,
    pausedElapsedSeconds: payload.pausedElapsedSeconds,
    workoutStartedAtMs: payload.workoutStartedAtMs,
    title: payload.title,
    workoutPlanId: payload.workoutPlanId,
    cardioMinutes: payload.cardioMinutes,
    cardioExtras: payload.cardioExtras ?? {
      ...EMPTY_CARDIO_EXTRAS,
    },
    exercises: payload.exercises,
    selectedExerciseId: payload.selectedExerciseId,
  });
  persistActiveWorkoutLocalNow();
}

/**
 * Decyzja przy konflikcie 409 na PUT (005, N-P13-1, poprawka B-1d z ADR 0004 p.13):
 * pusty/wygaszony payload z chmury wygrywa z aktywną sesją lokalną TYLKO, gdy to
 * dokładnie ta sama sesja, którą wygaszono (identyczny `workoutStartedAtMs` jak
 * `clearedSessionStartedAtMs` tombstone'u) — wtedy lokalna sesja jest martwa i
 * użytkownik ma zobaczyć zakończony trening, nie go wznawiać. W przeciwnym razie
 * (różny `startedAtMs`, albo tombstone bez tożsamości) lokalna sesja jest
 * inna/nowsza i wygrywa — zachowanie B-1d bez zmian. Wydzielona jako czysta
 * funkcja (bez DOM), żeby dało się ją testować bez komponentu.
 */
export function shouldApplyConflictPayload(
  localPayload: ActiveWorkoutCloudPayload,
  conflictPayload: ActiveWorkoutCloudPayload,
): boolean {
  if (hasActiveLocalSession(localPayload) && !hasActiveLocalSession(conflictPayload)) {
    const clearedId = conflictPayload.clearedSessionStartedAtMs ?? null;
    const localId = localPayload.workoutStartedAtMs ?? null;
    return clearedId != null && localId != null && clearedId === localId;
  }
  return true;
}

export async function fetchCloud(): Promise<ActiveWorkoutCloudRecord | null> {
  const res = await fetch("/api/active-workout-session", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    ok?: boolean;
    session?: ActiveWorkoutCloudRecord | null;
  };
  return json.session ?? null;
}

/**
 * Rezultat `putCloud`/`deleteCloud` niesie `status` i `retryAfterSec` (005, P1/P2) —
 * wołający (`ActiveWorkoutCloudSync`) używa ich do decyzji: 401/403 nie ponawiać
 * automatycznie, 429 respektować `Retry-After`, inne błędy ponawiać z backoffem
 * (`lib/active-workout-sync-backoff.ts`), zamiast dobijać natychmiast w pętli.
 */
export type CloudWriteResult = {
  ok: boolean;
  revision?: number;
  conflict?: ActiveWorkoutCloudRecord | null;
  status?: number;
  retryAfterSec?: number;
};

function parseRetryAfterSec(res: Response): number | undefined {
  const raw = res.headers?.get?.("Retry-After");
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function putCloud(
  payload: ActiveWorkoutCloudPayload,
  revision: number,
  deviceId: string,
  opts?: { keepalive?: boolean },
): Promise<CloudWriteResult> {
  await ensureCsrfCookie();
  const res = await fetch("/api/active-workout-session", {
    method: "PUT",
    credentials: "include",
    keepalive: opts?.keepalive === true,
    headers: {
      "Content-Type": "application/json",
      ...getXsrfHeaders(),
    },
    body: JSON.stringify({ payload, revision, deviceId }),
  });
  let json: {
    ok?: boolean;
    revision?: number;
    conflict?: boolean;
    session?: ActiveWorkoutCloudRecord | null;
  } = {};
  try {
    json = (await res.json()) as typeof json;
  } catch {
    /* empty body on some keepalive edge cases */
  }
  if (res.status === 409 && json.session) {
    return { ok: false, status: 409, conflict: json.session };
  }
  if (!res.ok || !json.ok) {
    return { ok: false, status: res.status, retryAfterSec: parseRetryAfterSec(res) };
  }
  return { ok: true, revision: json.revision };
}

/**
 * Serwer "wygasza" wiersz (nigdy go fizycznie nie usuwa) TYLKO, gdy `revision`
 * przekazana przez klienta jest >= aktualnej rewizji serwera — ta sama kontrola
 * optymistycznej współbieżności co `putCloud` (005, N-P13-7, ADR 0004 p.16).
 * Wywołujący MUSI przekazać rewizję, którą faktycznie zna (świeżo odczytaną z
 * chmury albo ostatnią zsynchronizowaną lokalnie) — nigdy stałą/zgadywaną wartość.
 */
export async function deleteCloud(revision: number): Promise<CloudWriteResult> {
  await ensureCsrfCookie();
  const res = await fetch("/api/active-workout-session", {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getXsrfHeaders(),
    },
    body: JSON.stringify({ revision }),
  });
  let json: {
    ok?: boolean;
    revision?: number;
    conflict?: boolean;
    session?: ActiveWorkoutCloudRecord | null;
  } = {};
  try {
    json = (await res.json()) as typeof json;
  } catch {
    /* empty body na edge-case'ach keepalive — rewizja zostaje bez zmian, kolejny push/pull naprawi */
  }
  if (res.status === 409 && json.session) {
    return { ok: false, status: 409, conflict: json.session };
  }
  if (!res.ok || !json.ok) {
    return { ok: false, status: res.status, retryAfterSec: parseRetryAfterSec(res) };
  }
  return { ok: true, revision: json.revision };
}
