"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eye, X } from "lucide-react";
import type { FriendLiveView } from "@/lib/community/friend-types";
import { CLIENT_POLL } from "@/lib/community/realtime-config";
import { useFriendLiveWatchStore } from "@/lib/stores/friend-live-watch";
import { cn } from "@/lib/utils";

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Podgląd treningu znajomego (read-only) — chip / rozwinięty panel + link do szczegółów.
 * Lista „kto trenuje” polluje rzadko; aktywny podgląd nieco częściej; pauza w tle.
 */
export function FriendLiveWatchWidget() {
  const pathname = usePathname();
  const watchingUserId = useFriendLiveWatchStore((s) => s.watchingUserId);
  const watchingDisplayName = useFriendLiveWatchStore(
    (s) => s.watchingDisplayName,
  );
  const clearWatching = useFriendLiveWatchStore((s) => s.clearWatching);
  const setWatching = useFriendLiveWatchStore((s) => s.setWatching);

  const [live, setLive] = useState<FriendLiveView | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [liveList, setLiveList] = useState<FriendLiveView[]>([]);

  const onWatchPage = pathname.startsWith("/community/friends/");
  /** Podczas aktywnego treningu — bez dolnego menu, wyżej / na górze jak widżet grupy. */
  const onActiveWorkout = pathname.startsWith("/active-workout");
  const dockClass = onActiveWorkout
    ? "right-3 top-[max(0.75rem,calc(env(safe-area-inset-top)+0.35rem))]"
    : "right-3 bottom-[calc(7.25rem+env(safe-area-inset-bottom))] md:right-5";

  const pullWatch = useCallback(async () => {
    if (!watchingUserId) {
      setLive(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/community/friends/${watchingUserId}/live`,
        { credentials: "include", cache: "no-store" },
      );
      if (res.status === 403) {
        clearWatching();
        setLive(null);
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { live?: FriendLiveView | null };
      setLive(data.live ?? null);
    } catch {
      /* ignore */
    }
  }, [watchingUserId, clearWatching]);

  const pullList = useCallback(async () => {
    if (watchingUserId) return;
    try {
      const res = await fetch("/api/community/friends/live", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { friends?: FriendLiveView[] };
      setLiveList(data.friends ?? []);
    } catch {
      /* ignore */
    }
  }, [watchingUserId]);

  useEffect(() => {
    if (onWatchPage) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const clear = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const tick = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      if (watchingUserId) void pullWatch();
      else void pullList();
    };

    const arm = () => {
      clear();
      if (document.visibilityState !== "visible") return;
      tick();
      const ms = watchingUserId
        ? CLIENT_POLL.friendLiveWatchMs
        : CLIENT_POLL.friendLiveListMs;
      timer = setInterval(tick, ms);
    };

    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      cancelled = true;
      clear();
      document.removeEventListener("visibilitychange", arm);
    };
  }, [pullWatch, pullList, onWatchPage, watchingUserId]);

  if (onWatchPage) return null;

  if (watchingUserId) {
    const name =
      live?.displayName || watchingDisplayName || "Znajomy";
    const p = live?.presence;
    return (
      <div
        className={cn(
          "pointer-events-auto fixed z-[58] flex max-w-[min(100vw-1.5rem,20rem)] flex-col items-end gap-2",
          dockClass,
        )}
      >
        {!expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--gym-gold)]/35 bg-black/80 px-3 py-2 text-[12px] font-semibold text-[var(--gym-gold)] shadow-lg backdrop-blur-md"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
            Podgląd · {name}
          </button>
        ) : (
          <div className="w-full rounded-2xl border border-white/12 bg-black/85 p-3 shadow-xl backdrop-blur-md">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-white">
                  {name}
                </p>
                <p className="text-[11px] text-white/45">Podgląd (bez dołączania)</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
                  aria-label="Zwiń"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => clearWatching()}
                  className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
                  aria-label="Zamknij podgląd"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {p ? (
              <div className="space-y-1 text-[12px] text-white/75">
                <p className="truncate font-medium text-white">{p.exerciseName}</p>
                <p>
                  Seria {p.setIndex}/{p.setTotal}
                  {p.reps != null ? ` · ${p.reps} powt.` : ""}
                  {p.weight > 0 ? ` · ${p.weight} kg` : ""}
                </p>
                <p className="tabular-nums text-white/45">
                  {formatElapsed(p.elapsedSeconds)} · {p.progressPercent}%
                </p>
              </div>
            ) : (
              <p className="text-[12px] text-white/45">Czeka na status…</p>
            )}
            <Link
              href={`/community/friends/${watchingUserId}/live`}
              className="mt-2.5 inline-flex min-h-9 w-full items-center justify-center rounded-xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10 text-[12px] font-semibold text-[var(--gym-gold)]"
            >
              Szczegóły
            </Link>
          </div>
        )}
      </div>
    );
  }

  if (liveList.length === 0) return null;

  const first = liveList[0]!;
  return (
    <div className={cn("pointer-events-auto fixed z-[58]", dockClass)}>
      <button
        type="button"
        onClick={() => setWatching(first.userId, first.displayName)}
        className="inline-flex max-w-[16rem] items-center gap-2 rounded-full border border-emerald-400/30 bg-black/80 px-3 py-2 text-[12px] font-semibold text-emerald-300 shadow-lg backdrop-blur-md"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="truncate">
          {first.displayName} trenuje
          {liveList.length > 1 ? ` +${liveList.length - 1}` : ""}
        </span>
      </button>
    </div>
  );
}
