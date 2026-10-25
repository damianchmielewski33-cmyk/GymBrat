"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { decideCloudHydrateAction, hasActiveLocalSession } from "@/lib/active-workout-cloud";
import {
  applyCloudPayload,
  deleteCloud,
  fetchCloud,
  putCloud,
  readRevision,
  shouldApplyConflictPayload,
  writeRevision,
} from "@/lib/active-workout-cloud-client";
import {
  persistActiveWorkoutLocalNow,
  snapshotActiveWorkoutPayload,
  subscribeActiveWorkoutPushRequests,
} from "@/lib/active-workout-persist";
import { markActiveWorkoutCloudHydrated } from "@/lib/active-workout-cloud-ready";
import {
  computeSyncRetryDelayMs,
  isAuthErrorStatus,
  isLikelyOfflineError,
} from "@/lib/active-workout-sync-backoff";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { useI18n } from "@/components/i18n/i18n-provider";

const DEVICE_KEY = "gymbrat:deviceId";
/** Krótki debounce — sesja ma być zapisywana na bieżąco, nie dopiero na koniec. */
const PUSH_DEBOUNCE_MS = 700;
const PUSH_INTERVAL_MS = 8_000;

/** Stabilny ID w pamięci, gdy localStorage jest niedostępny (nie regeneruj co wywołanie). */
let memoryDeviceId: string | null = null;

function getOrCreateDeviceId(): string {
  if (memoryDeviceId && memoryDeviceId.length >= 8) return memoryDeviceId;
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing && existing.length >= 8) {
      memoryDeviceId = existing;
      return existing;
    }
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
    memoryDeviceId = id;
    return id;
  } catch {
    const id =
      memoryDeviceId && memoryDeviceId.length >= 8
        ? memoryDeviceId
        : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    memoryDeviceId = id;
    return id;
  }
}

/**
 * Synchronizuje lokalny zustand z chmurą:
 * - na starcie: pull nowszej sesji z innego urządzenia (bez wskrzeszania duchów)
 * - po każdej zmianie (debounce) + co ~8 s + pagehide/visibility: push
 * - kolejka: gdy push trwa, kolejna zmiana nie ginie
 * - po resecie (pusta sesja): DELETE
 *
 * Logika fetch (`fetchCloud`/`putCloud`/`deleteCloud`/`applyCloudPayload`) jest
 * wydzielona do `lib/active-workout-cloud-client.ts` — testowalna bez DOM (ADR 0004 p.12).
 */
export function ActiveWorkoutCloudSync() {
  const { status: sessionStatus } = useSession();
  const authenticated = sessionStatus === "authenticated";
  const [banner, setBanner] = useState<string | null>(null);
  const { t } = useI18n();
  const deviceIdRef = useRef("");
  const pushingRef = useRef(false);
  /** Zmiana zgłoszona, gdy push już trwał — do odebrania natychmiast po zakończeniu (nie błąd). */
  const pendingChangeRef = useRef(false);
  const hydratedRef = useRef(false);
  const debounceRef = useRef<number | null>(null);
  /**
   * B-1c (ADR 0004 p.13): jednorazowy wartownik DELETE dla przejścia aktywna→pusta,
   * niezależny od wartości rewizji — po p.12 rewizja po DELETE jest zawsze ≥ 1, więc
   * `readRevision() > 0` byłoby prawdziwe na zawsze i wysyłałoby DELETE co każdy tick.
   */
  const clearedPushedRef = useRef(false);
  /** Liczba kolejnych błędów od ostatniego sukcesu — do wykładniczego backoffu (005, P2). */
  const retryAttemptRef = useRef(0);
  const retryTimeoutRef = useRef<number | null>(null);
  /**
   * Flaguje oczekiwanie na zdarzenie `online` (005, P2/R-4): dedupe nasłuchiwacza
   * (nie dodawaj drugiego, gdy pierwszy już czeka) i sygnał dla interwału, że nie
   * ma sensu tykać push-em, póki urządzenie jest offline.
   */
  const waitingOnlineRef = useRef(false);
  /**
   * P1 (005, sekcja 10, R-1): zalogowany użytkownik z wygasłą sesją po stronie
   * serwera (`useSession()` jeszcze nie wie o tym, `authenticated === true`)
   * dostaje 401/403 na push/delete. `scheduleRetry` nie planuje ponowienia dla
   * tych statusów (zamierzone — nie ma sensu ponawiać bez sesji), ale bez tej
   * flagi tick co 8 s i tak próbuje bez końca. Wznowienie: zmiana `authenticated`
   * z `false` na `true` (nowe zalogowanie/przeładowanie) resetuje flagę.
   */
  const pausedAuthRef = useRef(false);

  useEffect(() => {
    deviceIdRef.current = getOrCreateDeviceId();
  }, []);

  useEffect(() => {
    // P1: bez potwierdzonej sesji NIE hydratuj z chmury — gość albo sesja w trakcie
    // ustalania statusu (`loading`) nie mają czego synchronizować, a próba hydracji
    // bez sesji to niepotrzebny GET zakończony 401.
    if (!authenticated) return;
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
        // P1 (sekcja 10): wstrzymane po 401/403 — nie odpytuj GET-em do zmiany `authenticated`.
        if (pausedAuthRef.current) return;

        const localDeviceId = deviceIdRef.current || getOrCreateDeviceId();
        deviceIdRef.current = localDeviceId;

        const local = snapshotActiveWorkoutPayload();
        const cloud = await fetchCloud();
        if (cancelled) return;

        const action = decideCloudHydrateAction({
          localActive: hasActiveLocalSession(local),
          cloudActive: Boolean(cloud && hasActiveLocalSession(cloud.payload)),
          cloudDeviceId: cloud?.deviceId ?? "",
          localDeviceId,
          localRevision: readRevision(),
          cloudRevision: cloud?.revision ?? 0,
          cloudUpdatedAt: cloud?.updatedAt ?? 0,
        });

        if (action === "delete-cloud") {
          const result = await deleteCloud(cloud?.revision ?? 0);
          // Konflikt tutaj jest praktycznie nieosiągalny (rewizja jest odczytana
          // mikrosekundy wcześniej, w tym samym wywołaniu) — jeśli mimo to wystąpi,
          // nie robimy nic: lokal jest pusty z definicji tej gałęzi, kolejny
          // hydrate/push cykl zreconciluje stan bez utraty danych (005, N-P13-7,
          // ADR 0004 p.16.4a).
          if (!result.ok && result.conflict) {
            // brak akcji — zaakceptowane, patrz komentarz wyżej
          }
        } else if (
          (action === "apply" || action === "apply-other-device") &&
          cloud
        ) {
          applyCloudPayload(cloud.payload);
          writeRevision(cloud.revision);
          if (action === "apply-other-device") {
            setBanner(t("session.cloudResumed"));
            window.setTimeout(() => setBanner(null), 4500);
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
  }, [t, authenticated]);

  useEffect(() => {
    if (!authenticated) {
      // P1: bez sesji wstrzymujemy cały mechanizm (push/hydrate/interwał) — `hydratedRef`
      // wraca do `false`, więc ewentualne wywołanie `push()` z nieposprzątanego
      // listenera (np. w trakcie przejścia stanu) jest no-opem.
      hydratedRef.current = false;
      return;
    }

    // Sesja znów potwierdzona (zalogowanie/przeładowanie po wygaśnięciu) — odblokuj
    // ewentualną pauzę 401/403 z poprzedniego montażu efektu (P1, R-1).
    pausedAuthRef.current = false;

    let unmounted = false;

    const clearRetryTimeout = () => {
      if (retryTimeoutRef.current != null) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };

    /**
     * Planuje kolejną próbę po błędzie (005, P1/P2) — zamiast dobijać natychmiast
     * w `finally`. 401/403 (sesja nieważna) NIE planuje niczego: czekamy na
     * naturalny tick/zmianę zmiennej `authenticated`, inaczej gość albo
     * użytkownik z wygasłą sesją dostaje nieskończoną pętlę żądań (P1).
     */
    const scheduleRetry = (resultStatus?: number, retryAfterSec?: number | null) => {
      if (unmounted) return;
      if (isAuthErrorStatus(resultStatus)) {
        retryAttemptRef.current = 0;
        // P1 (sekcja 10, R-1): sesja nieważna — wstrzymaj tick i push() do zmiany
        // `authenticated`, inaczej co 8 s wysyłamy żądanie skazane na 401/403.
        pausedAuthRef.current = true;
        return;
      }
      retryAttemptRef.current += 1;
      const delay = computeSyncRetryDelayMs({
        attempt: retryAttemptRef.current,
        retryAfterSec,
      });
      clearRetryTimeout();
      retryTimeoutRef.current = window.setTimeout(() => {
        retryTimeoutRef.current = null;
        void push();
      }, delay);
    };

    /**
     * Brak sieci (P2): czekaj na `online`, nie odpytuj w pętli. Dedupe (R-4/tester):
     * jeśli nasłuchiwacz już czeka, nie dodawaj drugiego — kolejne wywołania z różnych
     * gałęzi błędu (push/DELETE) dzielą jeden listener.
     */
    const waitForOnline = () => {
      if (unmounted || typeof window === "undefined") return;
      if (waitingOnlineRef.current) return;
      waitingOnlineRef.current = true;
      window.addEventListener(
        "online",
        () => {
          waitingOnlineRef.current = false;
          if (!unmounted) void push();
        },
        { once: true },
      );
    };

    const push = async (opts?: { keepalive?: boolean }) => {
      if (!hydratedRef.current || unmounted || pausedAuthRef.current) return;
      if (pushingRef.current) {
        pendingChangeRef.current = true;
        return;
      }

      persistActiveWorkoutLocalNow();
      const payload = snapshotActiveWorkoutPayload();

      if (!hasActiveLocalSession(payload)) {
        if (clearedPushedRef.current) return; // już wysłane raz dla tego przejścia aktywna→pusta
        clearedPushedRef.current = true;
        pushingRef.current = true;
        try {
          const result = await deleteCloud(readRevision());
          if (!result.ok && !result.conflict) {
            clearedPushedRef.current = false; // błąd sieci/serwera — spróbuj ponownie po backoffie
            scheduleRetry(result.status, result.retryAfterSec);
          } else if (result.conflict) {
            // 409 (005, N-P13-7, ADR 0004 p.16.4b): ktoś inny ma teraz nowszą,
            // aktywną sesję w tym wierszu, o której to urządzenie nic nie wie —
            // NIE stosuj jej lokalnie (lokal jest pusty, ma tak zostać), tylko
            // zapamiętaj aktualną rewizję, żeby kolejne odczyty/zapisy nie
            // zderzały się z tą samą, przestarzałą wartością.
            writeRevision(result.conflict.revision);
            retryAttemptRef.current = 0;
          } else if (result.ok && result.revision != null) {
            writeRevision(result.revision);
            retryAttemptRef.current = 0;
          }
        } catch {
          // R-4 (005): DELETE rzucił (np. brak sieci) — wiersz zostaje w chmurze.
          // Traktuj jak błąd sieciowy reszty pliku: zresetuj wartownik, żeby
          // DELETE spróbował ponownie, i czekaj na `online`/backoff zamiast
          // zostawić nieobsłużony wyjątek i porzucone DELETE.
          clearedPushedRef.current = false;
          if (isLikelyOfflineError()) {
            waitForOnline();
          } else {
            scheduleRetry();
          }
        } finally {
          pushingRef.current = false;
          if (pendingChangeRef.current) {
            pendingChangeRef.current = false;
            void push();
          }
        }
        return;
      }
      clearedPushedRef.current = false; // sesja znów aktywna — jedno DELETE przy następnym opróżnieniu

      pushingRef.current = true;
      pendingChangeRef.current = false;
      try {
        const result = await putCloud(
          payload,
          readRevision(),
          deviceIdRef.current || getOrCreateDeviceId(),
          opts,
        );
        if (result.conflict) {
          retryAttemptRef.current = 0;
          if (!shouldApplyConflictPayload(payload, result.conflict.payload)) {
            // Pusty/wygaszony stan w chmurze nie wygrywa z aktywną sesją lokalną (005,
            // B-1d) — przejmij tylko rewizję i wypchnij ponownie lokalny stan.
            writeRevision(result.conflict.revision);
            pendingChangeRef.current = true;
          } else {
            applyCloudPayload(result.conflict.payload);
            writeRevision(result.conflict.revision);
            setBanner(t("session.cloudUpdated"));
            window.setTimeout(() => setBanner(null), 4000);
          }
        } else if (result.ok && result.revision != null) {
          writeRevision(result.revision);
          retryAttemptRef.current = 0;
        } else if (!result.ok) {
          // Nieudany push (429/5xx/401/403) — backoff albo stop, patrz scheduleRetry (P2).
          scheduleRetry(result.status, result.retryAfterSec);
        }
      } catch {
        // Błąd sieci (fetch odrzucony) — offline: czekaj na `online`; inaczej backoff (P2).
        if (isLikelyOfflineError()) {
          waitForOnline();
        } else {
          scheduleRetry();
        }
      } finally {
        pushingRef.current = false;
        if (pendingChangeRef.current) {
          pendingChangeRef.current = false;
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

    /**
     * P2 (005): tick co 8 s musi pomijać push, gdy ponowienie jest już zaplanowane
     * (`retryTimeoutRef`) albo czekamy na `online` — inaczej backoff tylko się
     * dokłada do regularnego ticku, a realna częstotliwość żądań przy 429/5xx nie
     * spada. P1/R-1 (sekcja 10): pomija też, gdy jesteśmy wstrzymani po 401/403
     * (`pausedAuthRef`) — do zmiany `authenticated`.
     */
    const id = window.setInterval(() => {
      if (retryTimeoutRef.current != null || waitingOnlineRef.current || pausedAuthRef.current) return;
      void push();
    }, PUSH_INTERVAL_MS);

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
      unmounted = true;
      clearRetryTimeout();
      window.clearInterval(id);
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flushOnLeave);
      window.removeEventListener("freeze", flushOnLeave);
      unsubStore();
      unsubReq();
    };
  }, [t, authenticated]);

  if (!banner) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-[120] w-[min(92vw,24rem)] -translate-x-1/2 rounded-full border border-[var(--gym-gold)]/35 bg-[#1a1a1a]/95 px-4 py-2 text-center text-xs font-medium text-[var(--gym-gold)] shadow-lg backdrop-blur">
      {banner}
    </div>
  );
}
