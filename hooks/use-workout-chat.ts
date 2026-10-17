"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import type { MentionCandidate } from "@/lib/community/feed-mentions";
import type {
  ChatChannelView,
  ChatKind,
  ChatMessageView,
  ChatTypingUser,
} from "@/lib/community/chat-types";

type OpenPayload =
  | { kind: "team"; teamId: string; title?: string }
  | { kind: "workout"; groupSessionId: string }
  | {
      kind: "challenge";
      challengeId: string;
      teamId: string;
      title?: string;
    };

export function useWorkoutChat(enabled: boolean) {
  const [channel, setChannel] = useState<ChatChannelView | null>(null);
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [mentions, setMentions] = useState<MentionCandidate[]>([]);
  const [typing, setTyping] = useState<ChatTypingUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sinceRef = useRef(Date.now());
  const channelIdRef = useRef<string | null>(null);

  const mergeMessages = useCallback((incoming: ChatMessageView[]) => {
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]));
      for (const m of incoming) map.set(m.id, m);
      return [...map.values()].sort((a, b) => a.createdAt - b.createdAt);
    });
  }, []);

  const openChannel = useCallback(
    async (payload: OpenPayload) => {
      setLoading(true);
      setError(null);
      try {
        await ensureCsrfCookie();
        const res = await fetch("/api/community/chat/channels", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...getXsrfHeaders(),
          },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          channel?: ChatChannelView;
          messages?: ChatMessageView[];
          hasMore?: boolean;
          mentions?: MentionCandidate[];
        };
        if (!res.ok || !data.channel) {
          setError(data.error ?? "Nie udało się otworzyć czatu.");
          return null;
        }
        setChannel(data.channel);
        channelIdRef.current = data.channel.id;
        setMessages(data.messages ?? []);
        setHasMore(!!data.hasMore);
        setMentions(data.mentions ?? []);
        sinceRef.current = Date.now();
        return data.channel;
      } catch {
        setError("Błąd sieci.");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadOlder = useCallback(async () => {
    const channelId = channelIdRef.current;
    if (!channelId || messages.length === 0) return;
    const oldest = messages[0]!.createdAt;
    const res = await fetch(
      `/api/community/chat/${channelId}/messages?before=${oldest}`,
      { credentials: "include" },
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      messages?: ChatMessageView[];
      hasMore?: boolean;
    };
    if (data.messages?.length) {
      setMessages((prev) => {
        const map = new Map(data.messages!.map((m) => [m.id, m]));
        for (const m of prev) map.set(m.id, m);
        return [...map.values()].sort((a, b) => a.createdAt - b.createdAt);
      });
    }
    setHasMore(!!data.hasMore);
  }, [messages]);

  const sendMessage = useCallback(
    async (body: string, parentMessageId?: string | null) => {
      const channelId = channelIdRef.current;
      if (!channelId) return { ok: false as const, error: "Brak kanału." };
      await ensureCsrfCookie();
      const res = await fetch(`/api/community/chat/${channelId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getXsrfHeaders(),
        },
        body: JSON.stringify({
          body,
          parentMessageId: parentMessageId ?? null,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: ChatMessageView;
      };
      if (!res.ok || !data.message) {
        return { ok: false as const, error: data.error ?? "Nie wysłano." };
      }
      mergeMessages([data.message]);
      return { ok: true as const, message: data.message };
    },
    [mergeMessages],
  );

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      await ensureCsrfCookie();
      const res = await fetch(
        `/api/community/chat/messages/${messageId}/reactions`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...getXsrfHeaders(),
          },
          body: JSON.stringify({ emoji }),
        },
      );
      if (!res.ok) return;
      // Optimistic local toggle; SSE will reconcile
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const existing = m.reactions.find((r) => r.emoji === emoji);
          let reactions = [...m.reactions];
          if (existing?.me) {
            reactions = reactions
              .map((r) =>
                r.emoji === emoji
                  ? { ...r, count: r.count - 1, me: false }
                  : r,
              )
              .filter((r) => r.count > 0);
          } else if (existing) {
            reactions = reactions.map((r) =>
              r.emoji === emoji ? { ...r, count: r.count + 1, me: true } : r,
            );
          } else {
            reactions = [...reactions, { emoji, count: 1, me: true }];
          }
          return { ...m, reactions };
        }),
      );
    },
    [],
  );

  const markRead = useCallback(async (lastReadMessageId?: string | null) => {
    const channelId = channelIdRef.current;
    if (!channelId) return;
    await ensureCsrfCookie();
    await fetch(`/api/community/chat/${channelId}/read`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...getXsrfHeaders(),
      },
      body: JSON.stringify({ lastReadMessageId: lastReadMessageId ?? null }),
    });
    setChannel((c) => (c ? { ...c, unreadCount: 0 } : c));
  }, []);

  const setTypingState = useCallback(async (isTyping: boolean) => {
    const channelId = channelIdRef.current;
    if (!channelId) return;
    await ensureCsrfCookie();
    await fetch(`/api/community/chat/${channelId}/typing`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...getXsrfHeaders(),
      },
      body: JSON.stringify({ typing: isTyping }),
    });
  }, []);

  const search = useCallback(async (query: string) => {
    const channelId = channelIdRef.current;
    if (!channelId) return [] as ChatMessageView[];
    const res = await fetch(
      `/api/community/chat/${channelId}/search?q=${encodeURIComponent(query)}`,
      { credentials: "include" },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { messages?: ChatMessageView[] };
    return data.messages ?? [];
  }, []);

  const deleteMessage = useCallback(async (messageId: string) => {
    await ensureCsrfCookie();
    const res = await fetch(`/api/community/chat/messages/${messageId}`, {
      method: "DELETE",
      credentials: "include",
      headers: getXsrfHeaders(),
    });
    if (!res.ok) return false;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, deleted: true, body: "Wiadomość usunięta", reactions: [] }
          : m,
      ),
    );
    return true;
  }, []);

  // SSE
  useEffect(() => {
    if (!enabled || !channel?.id) return;
    const channelId = channel.id;
    let es: EventSource | null = null;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const refreshFromEvents = async (
      kinds: Set<string>,
      entityIds: string[],
    ) => {
      if (!kinds.has("message") && !kinds.has("reaction")) return;
      const since = Math.max(0, sinceRef.current - 5_000);
      const ids =
        kinds.has("reaction") || kinds.has("message")
          ? entityIds.slice(0, 40).join(",")
          : "";
      const qs = new URLSearchParams({ since: String(since) });
      if (ids) qs.set("ids", ids);
      const res = await fetch(
        `/api/community/chat/${channelId}/sync?${qs.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages?: ChatMessageView[];
        typing?: ChatTypingUser[];
      };
      if (data.messages?.length) mergeMessages(data.messages);
      if (data.typing) setTyping(data.typing);
    };

    const connect = () => {
      if (cancelled) return;
      es = new EventSource(
        `/api/community/chat/${channelId}/stream?since=${sinceRef.current}`,
      );

      es.addEventListener("chat", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as {
            since?: number;
            events?: Array<{ kind: string; entityId: string }>;
          };
          if (typeof data.since === "number") sinceRef.current = data.since;
          if (data.events && data.events.length > 0) {
            const kinds = new Set(data.events.map((e) => e.kind));
            void refreshFromEvents(
              kinds,
              data.events.map((e) => e.entityId),
            );
          }
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("typing", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as {
            typing?: ChatTypingUser[];
          };
          setTyping(data.typing ?? []);
        } catch {
          /* ignore */
        }
      });

      es.onerror = () => {
        es?.close();
        es = null;
        if (cancelled) return;
        retryTimer = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [enabled, channel?.id, mergeMessages]);

  return {
    channel,
    messages,
    hasMore,
    mentions,
    typing,
    loading,
    error,
    openChannel,
    loadOlder,
    sendMessage,
    toggleReaction,
    markRead,
    setTypingState,
    search,
    deleteMessage,
    kind: (channel?.kind ?? null) as ChatKind | null,
  };
}
