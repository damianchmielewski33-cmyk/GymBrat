"use client";

import { useEffect, useRef, useState } from "react";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import {
  hasActiveLocalSession,
  type ActiveWorkoutCloudPayload,
  type ActiveWorkoutCloudRecord,
} from "@/lib/active-workout-cloud";
import { markActiveWorkoutCloudHydrated } from "@/lib/active-workout-cloud-ready";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { useI18n } from "@/components/i18n/i18n-provider";

const DEVICE_KEY = "gymbrat:deviceId";
const REVISION_KEY = "gymbrat:activeSessionRevision";
const PUSH_DEBOUNCE_MS = 1800;

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

function snapshotFromStore(): ActiveWorkoutCloudPayload {
  const s = useActiveWorkoutStore.getState();
  return {
    startedAt: s.startedAt,
    pausedElapsedSeconds: s.pausedElapsedSeconds,
    workoutStartedAtMs: s.workoutStartedAtMs,
    title: s.title,
    workoutPlanId: s.workoutPlanId,
    cardioMinutes: s.cardioMinutes,
    exercises: s.exercises,
    selectedExerciseId: s.selectedExerciseId,
  };
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
): Promise<{ ok: boolean; revision?: number; conflict?: ActiveWorkoutCloudRecord | null }> {
  await ensureCsrfCookie();
  const res = await fetch("/api/active-workout-session", {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getXsrfHeaders(),
    },
    body: JSON.stringify({ payload, revision, deviceId }),
  });
  const json = (await res.json()) as {
    ok?: boolean;
    revision?: number;
    conflict?: boolean;
    session?: ActiveWorkoutCloudRecord | null;
  };
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
 * - debounce po zmianach + co ~12 s + visibility: push
 * - po resecie (pusta sesja): DELETE
 */
export function ActiveWorkoutCloudSync() {
  const [banner, setBanner] = useState<string | null>(null);
  const { t } = useI18n();
  const deviceIdRef = useRef("");
  const pushingRef = useRef(false);
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

        const local = snapshotFromStore();
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
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const push = async () => {
      if (!hydratedRef.current || pushingRef.current) return;
      const payload = snapshotFromStore();
      if (!hasActiveLocalSession(payload)) {
        if (readRevision() > 0) {
          pushingRef.current = true;
          try {
            await deleteCloud();
          } finally {
            pushingRef.current = false;
          }
        }
        return;
      }
      pushingRef.current = true;
      try {
        const result = await putCloud(
          payload,
          readRevision(),
          deviceIdRef.current || getOrCreateDeviceId(),
        );
        if (result.conflict) {
          applyCloudPayload(result.conflict.payload);
          writeRevision(result.conflict.revision);
          setBanner(t("session.cloudUpdated"));
          window.setTimeout(() => setBanner(null), 4000);
        } else if (result.ok && result.revision != null) {
          writeRevision(result.revision);
        }
      } finally {
        pushingRef.current = false;
      }
    };

    const schedulePush = () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        void push();
      }, PUSH_DEBOUNCE_MS);
    };

    const id = window.setInterval(() => void push(), 12_000);
    const onVis = () => {
      if (document.visibilityState === "hidden") void push();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onVis);

    const unsub = useActiveWorkoutStore.subscribe(() => {
      if (!hydratedRef.current) return;
      schedulePush();
    });

    return () => {
      window.clearInterval(id);
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onVis);
      unsub();
    };
  }, []);

  if (!banner) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-[120] w-[min(92vw,24rem)] -translate-x-1/2 rounded-full border border-[var(--gym-gold)]/35 bg-[#1a1a1a]/95 px-4 py-2 text-center text-xs font-medium text-[var(--gym-gold)] shadow-lg backdrop-blur">
      {banner}
    </div>
  );
}
