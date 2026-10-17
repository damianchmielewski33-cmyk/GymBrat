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
const SEEN_FLUSH_MS = 450;

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

function NotificationRow({
  n,
  onOpen,
  onSeen,
}: {
  n: NotificationView;
  onOpen: (n: NotificationView) => void;
  onSeen: (id: string) => void;
}) {
  const rowRef = useRef<HTMLLIElement>(null);
  const Icon = kindIcon(n.kind);

  useEffect(() => {
    if (!n.unread) return;
    const el = rowRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting && e.intersectionRatio > 0)) {
          return;
        }
        io.disconnect();
        onSeen(n.id);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [n.id, n.unread, onSeen]);

  return (
    <li ref={rowRef}>
      <button
        type="button"
        onClick={() => onOpen(n)}
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
  const pendingSeen = useRef(new Set<string>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterRef = useRef(filter);
  filterRef.current = filter;

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

  const applyLocalRead = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setItems((prev) => {
      if (filterRef.current === "unread") {
        return prev.filter((n) => !idSet.has(n.id));
      }
      return prev.map((n) =>
        idSet.has(n.id) ? { ...n, unread: false, readAt: Date.now() } : n,
      );
    });
  }, []);

  const postMarkRead = useCallback(
    async (body: { ids?: string[]; all?: boolean }) => {
      await ensureCsrfCookie();
      await fetch("/api/community/notifications/read", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getXsrfHeaders(),
        },
        body: JSON.stringify(body),
      });
      await refreshCount();
    },
    [refreshCount],
  );

  const flushSeen = useCallback(async () => {
    const ids = [...pendingSeen.current];
    pendingSeen.current.clear();
    if (ids.length === 0) return;
    applyLocalRead(ids);
    try {
      await postMarkRead({ ids });
    } catch {
      /* badge odświeży się przy następnym pollu */
    }
  }, [applyLocalRead, postMarkRead]);

  const queueSeen = useCallback(
    (id: string) => {
      if (pendingSeen.current.has(id)) return;
      pendingSeen.current.add(id);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => {
        void flushSeen();
      }, SEEN_FLUSH_MS);
    },
    [flushSeen],
  );

  useEffect(
    () => () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      void flushSeen();
    },
    [flushSeen],
  );

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

  const markAllRead = async () => {
    setMarking(true);
    try {
      applyLocalRead(items.filter((n) => n.unread).map((n) => n.id));
      await postMarkRead({ all: true });
      if (filter === "unread") await load();
    } finally {
      setMarking(false);
    }
  };

  const onOpen = useCallback(
    (n: NotificationView) => {
      if (n.unread) queueSeen(n.id);
      if (n.href) router.push(n.href);
    },
    [queueSeen, router],
  );

  const filters: Array<{ id: "all" | "unread" | NotificationKind; label: string }> =
    [
      { id: "all", label: "Wszystkie" },
      { id: "unread", label: "Nieprzeczytane" },
      ...NOTIFICATION_KINDS.map((k) => ({
        id: k as NotificationKind,
        label: notificationKindLabel(k),
      })),
    ];

  const hasUnread = items.some((n) => n.unread);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="app-label text-[var(--gym-gold)]">Społeczność</p>
          <h1 className="mt-1.5 font-heading text-[24px] font-semibold tracking-tight text-white sm:text-[28px]">
            Powiadomienia
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-white/45">
            Widoczne powiadomienia oznaczają się same jako przeczytane.
          </p>
        </div>
        {hasUnread ? (
          <button
            type="button"
            disabled={marking}
            onClick={() => void markAllRead()}
            className="min-h-11 shrink-0 rounded-2xl border border-white/10 px-3.5 text-[12px] font-semibold text-white/70 transition hover:text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/45"
          >
            {marking ? "Oznaczanie…" : "Oznacz wszystkie"}
          </button>
        ) : null}
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
          {items.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              onOpen={onOpen}
              onSeen={queueSeen}
            />
          ))}
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
