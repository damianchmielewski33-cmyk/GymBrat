"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import type { FriendLiveView } from "@/lib/community/friend-types";
import { useFriendLiveWatchStore } from "@/lib/stores/friend-live-watch";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function FriendLiveDetailClient({
  subjectUserId,
  initialName,
}: {
  subjectUserId: string;
  initialName?: string | null;
}) {
  const setWatching = useFriendLiveWatchStore((s) => s.setWatching);
  const [live, setLive] = useState<FriendLiveView | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  const pull = useCallback(async () => {
    try {
      const res = await fetch(`/api/community/friends/${subjectUserId}/live`, {
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 403) {
        setForbidden(true);
        setLive(null);
        setLoading(false);
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { live?: FriendLiveView | null };
      setForbidden(false);
      setLive(data.live ?? null);
      if (data.live) {
        setWatching(subjectUserId, data.live.displayName);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [subjectUserId, setWatching]);

  useEffect(() => {
    void pull();
    const t = window.setInterval(() => void pull(), 900);
    return () => window.clearInterval(t);
  }, [pull]);

  useEffect(() => {
    setWatching(subjectUserId, initialName ?? null);
  }, [subjectUserId, initialName, setWatching]);

  const name = live?.displayName || initialName || "Znajomy";
  const p = live?.presence;

  return (
    <div className="space-y-5 pb-10">
      <Link
        href="/community/friends"
        className="inline-flex items-center gap-1.5 text-[13px] text-white/50 hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Znajomi
      </Link>

      <header className="space-y-1">
        <p className="app-label text-[var(--gym-gold)]">Podgląd treningu</p>
        <h1 className="font-heading text-[24px] font-semibold text-white">
          {name}
        </h1>
        <p className="text-[13px] text-white/45">
          Tylko odczyt — nie dołączasz do sesji i nie publikujesz własnego
          status w ich treningu.
        </p>
      </header>

      {forbidden ? (
        <div className="app-card p-5 text-[14px] text-white/60">
          Brak dostępu. Włączcie oboje „Udostępniaj trening” w ustawieniach
          znajomości.
          <Link
            href="/community/friends"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-4 inline-flex min-h-11 w-full",
            )}
          >
            Wróć do znajomych
          </Link>
        </div>
      ) : loading && !live ? (
        <div className="app-card animate-pulse p-8 text-center text-white/40">
          Ładowanie…
        </div>
      ) : !live ? (
        <div className="app-card space-y-3 p-5">
          <p className="text-[14px] text-white/60">
            {name} nie trenuje teraz (albo status wygasł).
          </p>
          <p className="text-[12px] text-white/35">
            Dostaniesz powiadomienie, gdy znajomy z mutual share zacznie
            trening.
          </p>
        </div>
      ) : (
        <div className="app-card space-y-4 p-5">
          <div className="flex items-center gap-2 text-emerald-300">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[12px] font-semibold uppercase tracking-wide">
              Na żywo ·{" "}
              {p?.phase === "rest"
                ? "przerwa"
                : p?.phase === "done"
                  ? "koniec"
                  : "ćwiczenie"}
            </span>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/35">
              Ćwiczenie
            </p>
            <p className="mt-1 font-heading text-[22px] font-semibold text-white">
              {p?.exerciseName ?? "—"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Seria" value={`${p?.setIndex ?? 0}/${p?.setTotal ?? 0}`} />
            <Stat
              label="Powtórzenia"
              value={p?.reps != null ? String(p.reps) : "—"}
            />
            <Stat
              label="Ciężar"
              value={p && p.weight > 0 ? `${p.weight} kg` : "—"}
            />
            <Stat
              label="Czas"
              value={formatElapsed(p?.elapsedSeconds ?? 0)}
            />
          </div>

          <div>
            <div className="mb-1.5 flex justify-between text-[11px] text-white/40">
              <span>Postęp</span>
              <span className="tabular-nums">{p?.progressPercent ?? 0}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--gym-gold)] transition-[width] duration-300"
                style={{ width: `${p?.progressPercent ?? 0}%` }}
              />
            </div>
          </div>

          {p?.restRemaining != null && p.restRemaining > 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white/70">
              Przerwa: {p.restRemaining}s
            </p>
          ) : null}

          <p className="inline-flex items-center gap-1.5 text-[12px] text-white/35">
            <Eye className="h-3.5 w-3.5" aria-hidden />
            Odświeżanie ~1 s
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-white/35">{label}</p>
      <p className="mt-1 font-metric text-[18px] tabular-nums text-white">
        {value}
      </p>
    </div>
  );
}
