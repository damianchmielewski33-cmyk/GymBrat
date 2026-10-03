"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Footprints, Square, X } from "lucide-react";
import { createCardioLog } from "@/actions/cardio";
import { CardioRouteMap } from "@/components/cardio/cardio-route-map";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { cn } from "@/lib/utils";

type GeoPoint = { lat: number; lng: number; t: number; accuracy: number | null };

function haversineM(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function formatElapsed(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

function formatPace(elapsedSec: number, distanceM: number): string {
  if (distanceM < 40 || elapsedSec < 5) return "--:--";
  const minPerKm = elapsedSec / 60 / (distanceM / 1000);
  if (!Number.isFinite(minPerKm) || minPerKm <= 0 || minPerKm > 60) {
    return "--:--";
  }
  const whole = Math.floor(minPerKm);
  const frac = Math.round((minPerKm - whole) * 60);
  return `${whole}:${String(frac).padStart(2, "0")}`;
}

function formatKm(distanceM: number): string {
  const km = distanceM / 1000;
  return km.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CardioRecordClient() {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [elapsedSec, setElapsedSec] = useState(0);
  const [distanceM, setDistanceM] = useState(0);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [geoOk, setGeoOk] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();
  const startedAtRef = useRef<number>(Date.now());
  const watchIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<GeoPoint | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch {
        /* ignore — browser may deny */
      }
    }

    void requestWakeLock();

    const onVis = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    if (!navigator.geolocation) {
      setGeoOk(false);
    } else {
      setGeoOk(true);
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (cancelled) return;
          const next: GeoPoint = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            t: Date.now(),
            accuracy:
              typeof pos.coords.accuracy === "number"
                ? pos.coords.accuracy
                : null,
          };
          setAccuracyM(next.accuracy);
          const prev = lastPointRef.current;
          if (prev && next.t - prev.t < 30_000) {
            const d = haversineM(prev, next);
            if (d > 1 && d < 80) setDistanceM((m) => m + d);
          }
          lastPointRef.current = next;
          setPoints((prevPts) => {
            const last = prevPts[prevPts.length - 1];
            if (
              last &&
              Math.abs(last.lat - next.lat) < 1e-6 &&
              Math.abs(last.lng - next.lng) < 1e-6
            ) {
              return prevPts;
            }
            return [...prevPts, next].slice(-800);
          });
        },
        () => {
          if (!cancelled) setGeoOk(false);
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
      );
    }

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      void wakeLockRef.current?.release().catch(() => undefined);
      wakeLockRef.current = null;
    };
  }, []);

  function stopAndSave() {
    const totalSec = Math.max(
      1,
      Math.floor((Date.now() - startedAtRef.current) / 1000),
    );
    const minutes = Math.max(1, Math.round(totalSec / 60));
    const km =
      distanceM > 20 ? Math.round((distanceM / 1000) * 100) / 100 : null;
    startTransition(async () => {
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      void wakeLockRef.current?.release().catch(() => undefined);
      wakeLockRef.current = null;

      const estimatedSteps =
        distanceM > 20 ? Math.round(distanceM / 0.78) : null;
      const res = await createCardioLog({
        title: "Marsz",
        cardioMinutes: minutes,
        distanceKm: km,
        steps: estimatedSteps,
        notes:
          geoOk === false
            ? "Bez GPS — tylko czas"
            : points.length > 0
              ? `GPS: ${points.length} pkt`
              : undefined,
      });
      if (!res.ok) {
        notifyError(res.error);
        return;
      }
      notifySaved("Zapisano trasę.");
      router.push(res.id ? `/cardio/${res.id}` : "/cardio");
      router.refresh();
    });
  }

  const steps = useMemo(
    () => (distanceM > 0 ? Math.round(distanceM / 0.78) : 0),
    [distanceM],
  );
  const pace = formatPace(elapsedSec, distanceM);
  const mapPoints = useMemo(
    () => points.map((p) => ({ lat: p.lat, lng: p.lng })),
    [points],
  );

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black">
      <div className="relative min-h-0 flex-1">
        <CardioRouteMap points={mapPoints} className="absolute inset-0" />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Link
            href="/cardio"
            aria-label="Zamknij nagrywanie"
            className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md"
          >
            <X className="h-5 w-5" />
          </Link>
          <div className="pointer-events-none inline-flex items-center gap-2 rounded-full bg-black/55 px-3.5 py-2 backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[13px] font-medium text-white">
              Nagrywam trasę
            </span>
          </div>
        </div>
      </div>

      <section className="relative z-10 shrink-0 rounded-t-[28px] bg-black px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-12px_40px_rgba(0,0,0,0.55)]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
              Dystans
            </p>
            <p className="mt-1 font-metric text-[44px] leading-none text-white">
              {formatKm(distanceM)}
              <span className="ml-1.5 text-[18px] text-white/50">km</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
              Czas
            </p>
            <p className="mt-1 text-[32px] font-semibold tabular-nums leading-none text-white">
              {formatElapsed(elapsedSec)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/[0.08] bg-[#121212] px-2.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Tempo
            </p>
            <p className="mt-1.5 text-[20px] font-semibold tabular-nums leading-none text-white">
              {pace}
            </p>
            <p className="mt-1 text-[10px] text-white/35">min/km</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#121212] px-2.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Kroki
            </p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Footprints className="h-3.5 w-3.5 text-white/35" aria-hidden />
              <p className="text-[20px] font-semibold tabular-nums leading-none text-white">
                {steps}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#121212] px-2.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Punkty GPS
            </p>
            <p className="mt-1.5 text-[20px] font-semibold tabular-nums leading-none text-white">
              {points.length}
            </p>
            <p className="mt-1 text-[10px] tabular-nums text-white/35">
              {accuracyM != null ? `± ${Math.round(accuracyM)} m` : geoOk === false ? "brak GPS" : "—"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={stopAndSave}
          disabled={pending || elapsedSec < 3}
          className={cn(
            "mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#5c2a2a] text-[15px] font-semibold text-white",
            "hover:bg-[#6a3232] disabled:opacity-45",
          )}
        >
          <Square className="h-3.5 w-3.5 fill-[#e07a5f] text-[#e07a5f]" />
          {pending ? "Zapisuję…" : "Stop"}
        </button>

        <p className="mt-3 text-[11px] leading-relaxed text-white/40">
          Nagrywanie działa, gdy apka jest otwarta: ekran nie zgaśnie. Nie blokuj
          telefonu i nie przełączaj się na inne aplikacje, bo trasa przestanie
          się rysować.
        </p>
      </section>
    </div>
  );
}
