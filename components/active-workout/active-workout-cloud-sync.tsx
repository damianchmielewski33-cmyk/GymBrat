"use client";

import { useEffect, useRef, useState } from "react";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import {
  hasActiveLocalSession,
  type ActiveWorkoutCloudPayload,
  type ActiveWorkoutCloudRecord,
} from "@/lib/active-workout-cloud";
import {
  persistActiveWorkoutLocalNow,
  snapshotActiveWorkoutPayload,
  subscribeActiveWorkoutPushRequests,
} from "@/lib/active-workout-persist";
import { markActiveWorkoutCloudHydrated } from "@/lib/active-workout-cloud-ready";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { useI18n } from "@/components/i18n/i18n-provider";

const DEVICE_KEY = "gymbrat:deviceId";
const REVISION_KEY = "gymbrat:activeSessionRevision";
/** Krótki debounce — sesja ma być zapisywana na bieżąco, nie dopiero na koniec. */
const PUSH_DEBOUNCE_MS = 700;
const PUSH_INTERVAL_MS = 8_000;

function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return `dev-${Date.now()}`;
  }
}

function readRevision(): number {
  try {
    const n = Number(localStorage.getItem(REVISION_KEY) ?? "0");
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function writeRevision(n: number) {
  try {
    localStorage.setItem(REVISION_KEY, String(n));
  } catch {
    /* ignore */
  }
}

function applyCloudPayload(payload: ActiveWorkoutCloudPayload) {
  useActiveWorkoutStore.setState({
    startedAt: payload.startedAt,
    pausedElapsedSeconds: payload.pausedElapsedSeconds,
    workoutStartedAtMs: payload.workoutStartedAtMs,
    title: payload.title,
    workoutPlanId: payload.workoutPlanId,
    cardioMinutes: payload.cardioMinutes,
    exercises: payload.exercises,
    selectedExerciseId: payload.selectedExerciseId,
  });
  persistActiveWorkoutLocalNow();
}

async function fetchCloud(): Promise<ActiveWorkoutCloudRecord | null> {
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

async function putCloud(
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

async function deleteCloud(): Promise<void> {
  await ensureCsrfCookie();
  await fetch("/api/active-workout-session", {
    method: "DELETE",
    credentials: "include",
    headers: { ...getXsrfHeaders() },
  });
  writeRevision(0);
}

/**
 * Synchronizuje lokalny zustand z chmurą:
 * - na starcie: pull nowszej sesji z innego urządzenia
 * - po każdej zmianie (debounce) + co ~8 s + pagehide/visibility: push
 * - kolejka: gdy push trwa, kolejna zmiana nie ginie
 * - po resecie (pusta sesja): DELETE
 */
export function ActiveWorkoutCloudSync() {
  const [banner, setBanner] = useState<string | null>(null);
  const { t } = useI18n();
  const deviceIdRef = useRef("");
  const pushingRef = useRef(false);
  const pendingPushRef = useRef(false);
  const hydratedRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    deviceIdRef.current = getOrCreateDeviceId();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const api = useActiveWorkoutStore.persist;
        if (!api.hasHydrated()) {
          await new Promise<void>((resolve) => {
            const unsub = api.onFinishHydration(() => {
              unsub();
              resolve();
            });
          });
        }
        if (cancelled) return;

        const local = snapshotActiveWorkoutPayload();
        const cloud = await fetchCloud();
        if (cancelled) return;

        if (cloud && hasActiveLocalSession(cloud.payload)) {
          const localRev = readRevision();
          const cloudNewer = cloud.revision > localRev;
          const localEmpty = !hasActiveLocalSession(local);
          if (localEmpty || cloudNewer) {
            applyCloudPayload(cloud.payload);
            writeRevision(cloud.revision);
            if (cloud.deviceId !== deviceIdRef.current) {
              setBanner(t("session.cloudResumed"));
              window.setTimeout(() => setBanner(null), 4500);
            }
          }
        }
      } finally {
        if (!cancelled) {
          hydratedRef.current = true;
          markActiveWorkoutCloudHydrated();
          // Utrwal lokalnie po hydracji — nawet gdy chmura pusta.
          persistActiveWorkoutLocalNow();
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    const push = async (opts?: { keepalive?: boolean }) => {
      if (!hydratedRef.current) return;
      if (pushingRef.current) {
        pendingPushRef.current = true;
        return;
      }

      persistActiveWorkoutLocalNow();
      const payload = snapshotActiveWorkoutPayload();

      if (!hasActiveLocalSession(payload)) {
        if (readRevision() > 0) {
          pushingRef.current = true;
          try {
            await deleteCloud();
          } finally {
            pushingRef.current = false;
            if (pendingPushRef.current) {
              pendingPushRef.current = false;
              void push();
            }
          }
        }
        return;
      }

      pushingRef.current = true;
      pendingPushRef.current = false;
      try {
        const result = await putCloud(
          payload,
          readRevision(),
          deviceIdRef.current || getOrCreateDeviceId(),
          opts,
        );
        if (result.conflict) {
          applyCloudPayload(result.conflict.payload);
          writeRevision(result.conflict.revision);
          setBanner(t("session.cloudUpdated"));
          window.setTimeout(() => setBanner(null), 4000);
        } else if (result.ok && result.revision != null) {
          writeRevision(result.revision);
        } else if (!result.ok) {
          // Nieudany push — spróbuj ponownie przy następnej zmianie / interval.
          pendingPushRef.current = true;
        }
      } catch {
        pendingPushRef.current = true;
      } finally {
        pushingRef.current = false;
        if (pendingPushRef.current) {
          pendingPushRef.current = false;
          void push();
        }
      }
    };

    const schedulePush = (immediate = false) => {
      persistActiveWorkoutLocalNow();
      if (immediate) {
        if (debounceRef.current != null) {
          window.clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        void push();
        return;
      }
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        void push();
      }, PUSH_DEBOUNCE_MS);
    };

    const id = window.setInterval(() => void push(), PUSH_INTERVAL_MS);

    const flushOnLeave = () => {
      persistActiveWorkoutLocalNow();
      void push({ keepalive: true });
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flushOnLeave();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flushOnLeave);
    window.addEventListener("freeze", flushOnLeave);

    const unsubStore = useActiveWorkoutStore.subscribe(() => {
      if (!hydratedRef.current) return;
      schedulePush(false);
    });

    const unsubReq = subscribeActiveWorkoutPushRequests((immediate) => {
      if (!hydratedRef.current) return;
      schedulePush(immediate);
    });

    return () => {
      window.clearInterval(id);
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flushOnLeave);
      window.removeEventListener("freeze", flushOnLeave);
      unsubStore();
      unsubReq();
    };
  }, [t]);

  if (!banner) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-[120] w-[min(92vw,24rem)] -translate-x-1/2 rounded-full border border-[var(--gym-gold)]/35 bg-[#1a1a1a]/95 px-4 py-2 text-center text-xs font-medium text-[var(--gym-gold)] shadow-lg backdrop-blur">
      {banner}
    </div>
  );
}
