"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Flame,
  MessageCircle,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import {
  NOTIFICATION_KINDS,
  notificationKindLabel,
  type NotificationKind,
  type NotificationView,
} from "@/lib/community/notification-types";
import { useNotificationsRealtime } from "@/hooks/use-notifications-realtime";
import { cn } from "@/lib/utils";

const PAGE = 30;

function kindIcon(kind: NotificationKind) {
  switch (kind) {
    case "comment":
      return MessageCircle;
    case "reaction":
      return Sparkles;
    case "invite":
      return Users;
    case "live":
    case "friend_live":
      return Zap;
    case "challenge":
    case "achievement":
      return Trophy;
    case "ranking":
    case "hall_of_fame":
      return Flame;
    default:
      return Bell;
  }
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "teraz";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} godz.`;
  const d = Math.floor(h / 24);
  return `${d} dni`;
}

export function NotificationCenterClient() {
  const router = useRouter();
  const { bump, refreshCount } = useNotificationsRealtime(true);
  const [items, setItems] = useState<NotificationView[]>([]);
  const [filter, setFilter] = useState<"all" | "unread" | NotificationKind>(
    "all",
  );
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [marking, setMarking] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const buildQs = useCallback(
    (cursor?: number | null) => {
      const qs = new URLSearchParams();
      qs.set("limit", String(PAGE));
      if (filter === "unread") qs.set("unreadOnly", "1");
      else if (filter !== "all") qs.set("kind", filter);
      if (cursor) qs.set("cursor", String(cursor));
      return qs;
    },
    [filter],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/community/notifications?${buildQs()}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications?: NotificationView[];
        hasMore?: boolean;
      };
      setItems(data.notifications ?? []);
      setHasMore(!!data.hasMore);
    } finally {
      setLoading(false);
    }
  }, [buildQs]);

  useEffect(() => {
    void load();
  }, [load, bump]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || items.length === 0) return;
    setLoadingMore(true);
    try {
      const cursor = items[items.length - 1]!.createdAt;
      const res = await fetch(
        `/api/community/notifications?${buildQs(cursor)}`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications?: NotificationView[];
        hasMore?: boolean;
      };
      const next = data.notifications ?? [];
      setItems((prev) => {
        const map = new Map(prev.map((n) => [n.id, n]));
        for (const n of next) map.set(n.id, n);
        return [...map.values()].sort((a, b) => b.createdAt - a.createdAt);
      });
      setHasMore(!!data.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, items, buildQs]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  const markRead = async (ids?: string[], all?: boolean) => {
    setMarking(true);
    try {
      await ensureCsrfCookie();
      await fetch("/api/community/notifications/read", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getXsrfHeaders(),
        },
        body: JSON.stringify(all ? { all: true } : { ids }),
      });
      await refreshCount();
      await load();
    } finally {
      setMarking(false);
    }
  };

  const onOpen = async (n: NotificationView) => {
    if (n.unread) await markRead([n.id]);
    if (n.href) router.push(n.href);
  };

  const filters: Array<{ id: "all" | "unread" | NotificationKind; label: string }> =
    [
      { id: "all", label: "Wszystkie" },
      { id: "unread", label: "Nieprzeczytane" },
      ...NOTIFICATION_KINDS.map((k) => ({
        id: k as NotificationKind,
        label: notificationKindLabel(k),
      })),
    ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="app-label text-[var(--gym-gold)]">Społeczność</p>
          <h1 className="mt-1.5 font-heading text-[24px] font-semibold tracking-tight text-white sm:text-[28px]">
            Powiadomienia
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-white/45">
            Komentarze, reakcje, live, wyzwania i ogłoszenia — na żywo.
          </p>
        </div>
        <button
          type="button"
          disabled={marking || items.length === 0}
          onClick={() => void markRead(undefined, true)}
          className="min-h-11 shrink-0 rounded-2xl border border-white/10 px-3.5 text-[12px] font-semibold text-white/70 transition hover:text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/45"
        >
          {marking ? "Oznaczanie…" : "Oznacz przeczytane"}
        </button>
      </div>

      <div className="chip-scroll -mx-0.5 px-0.5">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "inline-flex min-h-10 items-center rounded-full border px-3.5 text-[11px] font-semibold uppercase tracking-wide",
              filter === f.id
                ? "border-[var(--gym-gold)]/40 bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]"
                : "border-white/10 bg-white/[0.03] text-white/50",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && items.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-white/40">
          Ładowanie…
        </p>
      ) : items.length === 0 ? (
        <div className="app-card p-8 text-center text-[13px] text-white/45">
          Brak powiadomień w tym filtrze.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const Icon = kindIcon(n.kind);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void onOpen(n)}
                  className={cn(
                    "flex min-h-[4.25rem] w-full items-start gap-3 rounded-2xl border px-3.5 py-3.5 text-left transition active:scale-[0.99]",
                    n.unread
                      ? "border-[var(--gym-gold)]/25 bg-[var(--gym-gold)]/[0.07]"
                      : "border-white/8 bg-white/[0.03] hover:bg-white/[0.05]",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
                      n.unread
                        ? "border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10 text-[var(--gym-gold)]"
                        : "border-white/10 bg-white/[0.04] text-white/55",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold text-white">
                        {n.title}
                      </span>
                      {n.collapsedCount > 1 ? (
                        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/60">
                          ×{n.collapsedCount}
                        </span>
                      ) : null}
                      {n.unread ? (
                        <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[var(--gym-gold)]" />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-relaxed text-white/55">
                      {n.body}
                    </span>
                    <span className="mt-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wide text-white/35">
                      <span>{notificationKindLabel(n.kind)}</span>
                      <span>·</span>
                      <span>{relativeTime(n.createdAt)}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          <div ref={sentinelRef} className="h-3" aria-hidden />
          {loadingMore ? (
            <li className="py-2 text-center text-[12px] text-white/40">
              Ładowanie…
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
