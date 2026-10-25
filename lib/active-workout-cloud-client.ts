/**
 * Klient chmury aktywnej sesji (`/api/active-workout-session`) — logika fetch +
 * mapowanie odpowiedzi, wydzielona z `components/active-workout/active-workout-cloud-sync.tsx`
 * (ADR 0004 p.12, zalecenie testera sekcja 9.8 "B-1 (test)") tak, żeby dało się ją
 * testować bez DOM. Next 16 nie wymaga, by moduł pomocniczy używany WYŁĄCZNIE przez
 * komponent kliencki miał własny znacznik `"use client"` — potrzebny jest tylko w
 * pliku komponentu, nie w czystych funkcjach, które on importuje.
 */
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import type {
  ActiveWorkoutCloudPayload,
  ActiveWorkoutCloudRecord,
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
    // Klucz idempotencji podróżuje razem ze stanem sesji (005, defekt B-1) — nigdy
    // regenerowany tu, tylko przy faktycznym starcie nowej sesji (start()/applyPlan()).
    operationId: payload.operationId ?? null,
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

export async function putCloud(
  payload: ActiveWorkoutCloudPayload,
  revision: number,
  deviceId: string,
  opts?: { keepalive?: boolean },
): Promise<{ ok: boolean; revision?: number; conflict?: ActiveWorkoutCloudRecord | null }> {
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
    return { ok: false, conflict: json.session };
  }
  if (!res.ok || !json.ok) return { ok: false };
  return { ok: true, revision: json.revision };
}

/**
 * Serwer "wygasza" wiersz (nigdy go fizycznie nie usuwa) i zwraca rewizję o +1
 * (005, B-1b) — nigdy nie zakładaj tu 0, bo zaległy klient z wyższą rewizją
 * mógłby nadpisać nową sesję.
 */
export async function deleteCloud(): Promise<boolean> {
  await ensureCsrfCookie();
  const res = await fetch("/api/active-workout-session", {
    method: "DELETE",
    credentials: "include",
    headers: { ...getXsrfHeaders() },
  });
  if (!res.ok) return false;
  let json: { ok?: boolean; revision?: number } = {};
  try {
    json = (await res.json()) as typeof json;
  } catch {
    /* empty body na edge-case'ach keepalive — rewizja zostaje bez zmian, kolejny push/pull naprawi */
  }
  if (typeof json.revision === "number" && json.revision >= 0) {
    writeRevision(json.revision);
  }
  return true;
}
