"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Square, Play } from "lucide-react";
import {
  routeDistanceKm,
  type GpsPoint,
} from "@/lib/cardio-machines";
import { Button } from "@/components/ui/button";

export function GpsTracker({
  onUpdate,
}: {
  onUpdate: (points: GpsPoint[], distanceKm: number) => void;
}) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<GpsPoint[]>([]);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  function start() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Geolokalizacja niedostępna w tej przeglądarce.");
      return;
    }
    setPoints([]);
    setActive(true);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next: GpsPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          t: Date.now(),
          accuracy: pos.coords.accuracy,
        };
        setPoints((prev) => {
          const merged = [...prev, next].slice(-2000);
          onUpdate(merged, routeDistanceKm(merged));
          return merged;
        });
      },
      (err) => {
        setError(err.message || "Brak dostępu do GPS");
        setActive(false);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
  }

  function stop() {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setActive(false);
  }

  const dist = routeDistanceKm(points);

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80">
          <MapPin className="h-4 w-4 text-[var(--neon)]" />
          GPS trasa
        </p>
        <p className="text-sm tabular-nums text-white/70">{dist} km · {points.length} pkt</p>
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      <div className="flex gap-2">
        {!active ? (
          <Button type="button" onClick={start} className="h-10">
            <Play className="mr-1.5 h-4 w-4" />
            Start GPS
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={stop} className="h-10">
            <Square className="mr-1.5 h-4 w-4" />
            Stop GPS
          </Button>
        )}
      </div>
      <p className="text-[11px] text-white/40">
        Wymaga zgody na lokalizację. Trasa zapisze się razem z sesją cardio.
      </p>
    </div>
  );
}
