"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  MessageCircle,
  Reply,
  Search,
  Send,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { useWorkoutChat } from "@/hooks/use-workout-chat";
import { CHAT_QUICK_EMOJI } from "@/lib/community/chat-types";
import type { ChatMessageView } from "@/lib/community/chat-types";
import { cn } from "@/lib/utils";

type OpenTarget =
  | { kind: "team"; teamId: string; title?: string }
  | { kind: "workout"; groupSessionId: string }
  | {
      kind: "challenge";
      challengeId: string;
      teamId: string;
      title?: string;
    };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Dzisiaj";
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Wczoraj";
  return d.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function highlightMentions(body: string, mentionIds: string[]): ReactNode {
  void mentionIds;
  const parts = body.split(/(@[A-Za-zÀ-ž0-9_]{2,40})/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="font-semibold text-[var(--gym-gold)]">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function WorkoutChatPanel({
  target,
  viewerUserId,
  className,
  compact,
  defaultOpen,
  onClose,
}: {
  target: OpenTarget;
  viewerUserId: string;
  className?: string;
  compact?: boolean;
  defaultOpen?: boolean;
  onClose?: () => void;
}) {
  const chat = useWorkoutChat(true);
  const {
    openChannel,
    markRead,
    messages,
    hasMore,
    mentions,
    typing,
    loading,
    error,
    channel,
    loadOlder,
    sendMessage,
    toggleReaction,
    setTypingState,
    search,
    deleteMessage,
  } = chat;
  const [open, setOpen] = useState(!!defaultOpen);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessageView | null>(null);
  const [emojiFor, setEmojiFor] = useState<string | null>(null);
  const [composerEmoji, setComposerEmoji] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<ChatMessageView[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedRef = useRef(false);
  const targetKey = JSON.stringify(target);

  useEffect(() => {
    if (!open || openedRef.current) return;
    openedRef.current = true;
    void openChannel(target);
    // targetKey stabilizuje identyfikator kanału
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetKey, openChannel]);

  useEffect(() => {
    if (!open || !messages.length) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    const last = messages[messages.length - 1];
    if (last) void markRead(last.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, open]);

  const filteredMentions = useMemo(() => {
    const q = mentionFilter.toLowerCase();
    return mentions
      .filter(
        (m) =>
          m.handle.toLowerCase().includes(q) ||
          m.displayName.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [mentions, mentionFilter]);

  const onDraftChange = (value: string) => {
    setDraft(value);
    const at = value.match(/@([A-Za-zÀ-ž0-9_]{0,40})$/);
    if (at) {
      setMentionOpen(true);
      setMentionFilter(at[1] ?? "");
    } else {
      setMentionOpen(false);
      setMentionFilter("");
    }
    void setTypingState(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      void setTypingState(false);
    }, 2200);
  };

  const insertMention = (handle: string) => {
    setDraft((d) => d.replace(/@([A-Za-zÀ-ž0-9_]{0,40})$/, `@${handle} `));
    setMentionOpen(false);
  };

  const submit = useCallback(async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    setComposerEmoji(false);
    setMentionOpen(false);
    const parentId = replyTo?.id ?? null;
    setReplyTo(null);
    void setTypingState(false);
    const result = await sendMessage(body, parentId);
    if (!result.ok) {
      setDraft(body);
    }
  }, [draft, replyTo, sendMessage, setTypingState]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const runSearch = async (q: string) => {
    setSearchQ(q);
    if (q.trim().length < 2) {
      setSearchHits([]);
      return;
    }
    const hits = await search(q.trim());
    setSearchHits(hits);
  };

  const typingLabel =
    typing.length === 0
      ? null
      : typing.length === 1
        ? `${typing[0]!.displayName} pisze…`
        : typing.length === 2
          ? `${typing[0]!.displayName} i ${typing[1]!.displayName} piszą…`
          : `${typing.length} osób pisze…`;

  const title =
    channel?.title ||
    (target.kind === "team"
      ? "Czat grupy"
      : target.kind === "workout"
        ? "Czat treningowy"
        : "Czat wyzwania");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--gym-gold)]/35 bg-black/60 px-3.5 py-3 text-[13px] font-semibold text-[var(--gym-gold)] shadow-lg backdrop-blur-md transition hover:border-[var(--gym-gold)]/60 hover:bg-black/75 sm:w-auto sm:justify-start",
          className,
        )}
      >
        <MessageCircle className="h-4 w-4" aria-hidden />
        Workout Chat
        {channel && channel.unreadCount > 0 ? (
          <span className="rounded-full bg-[var(--gym-gold)] px-1.5 py-0.5 text-[10px] font-bold text-black">
            {channel.unreadCount}
          </span>
        ) : null}
      </button>
    );
  }

  let lastDay = "";

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0e] shadow-[0_20px_60px_rgba(0,0,0,0.55)]",
        compact
          ? "h-[min(58dvh,28rem)] sm:h-[min(70vh,32rem)]"
          : "h-[min(62dvh,32rem)] sm:h-[min(72vh,40rem)]",
        className,
      )}
    >
      <header className="flex items-center gap-2 border-b border-white/8 bg-gradient-to-r from-[#121218] to-[#0b0b0e] px-3 py-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10 text-[var(--gym-gold)]">
          <MessageCircle className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-white">
            {title}
          </p>
          <p className="truncate text-[11px] text-white/45">
            {target.kind === "team"
              ? "Czat grupowy · live"
              : target.kind === "workout"
                ? "Czat treningowy · live"
                : "Czat wyzwania · na żywo"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Szukaj"
          onClick={() => setSearchOpen((v) => !v)}
          className="touch-target inline-flex items-center justify-center rounded-xl text-white/55 hover:bg-white/5 hover:text-white"
        >
          <Search className="h-4 w-4" />
        </button>
        {(onClose || !defaultOpen) && (
          <button
            type="button"
            aria-label="Zamknij"
            onClick={() => {
              setOpen(false);
              openedRef.current = false;
              onClose?.();
            }}
            className="touch-target inline-flex items-center justify-center rounded-xl text-white/55 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      {searchOpen ? (
        <div className="border-b border-white/8 bg-black/40 px-3 py-2">
          <input
            value={searchQ}
            onChange={(e) => void runSearch(e.target.value)}
            placeholder="Szukaj w wiadomościach…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-[var(--gym-gold)]/40"
          />
          {searchHits.length > 0 ? (
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
              {searchHits.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-white/70 hover:bg-white/5"
                    onClick={() => {
                      document
                        .getElementById(`chat-msg-${m.id}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "center" });
                      setSearchOpen(false);
                    }}
                  >
                    <span className="font-medium text-white/90">
                      {m.author.displayName}
                    </span>
                    : {m.body.slice(0, 80)}
                  </button>
                </li>
              ))}
            </ul>
          ) : searchQ.trim().length >= 2 ? (
            <p className="mt-2 text-[12px] text-white/40">Brak wyników.</p>
          ) : null}
        </div>
      ) : null}

      <div
        ref={listRef}
        className="flex-1 space-y-1 overflow-y-auto px-2 py-3"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Wiadomości czatu"
      >
        {hasMore ? (
          <button
            type="button"
            onClick={() => void loadOlder()}
            className="mx-auto mb-2 block rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/50 hover:text-white"
          >
            Wczytaj starsze
          </button>
        ) : null}

        {loading && messages.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-white/40">
            Ładowanie czatu…
          </p>
        ) : null}

        {error ? (
          <p className="py-6 text-center text-[13px] text-rose-300/90">
            {error}
          </p>
        ) : null}

        {!loading && !error && messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-[15px] font-semibold text-white/80">
              Tu zaczyna się rozmowa
            </p>
            <p className="max-w-[16rem] text-[12px] text-white/40">
              Emoji, odpowiedzi, reakcje i @oznaczenia — jak na Discordzie, tylko
              przy sztandze.
            </p>
          </div>
        ) : null}

        {messages.map((m) => {
          const day = formatDay(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = m.author.userId === viewerUserId;
          return (
            <div key={m.id}>
              {showDay ? (
                <div className="my-3 flex items-center gap-3 px-2">
                  <div className="h-px flex-1 bg-white/8" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    {day}
                  </span>
                  <div className="h-px flex-1 bg-white/8" />
                </div>
              ) : null}
              <article
                id={`chat-msg-${m.id}`}
                className="group relative rounded-2xl px-2 py-1.5 hover:bg-white/[0.03]"
              >
                {m.parentMessageId && m.parentPreview ? (
                  <button
                    type="button"
                    className="mb-1 ml-11 flex max-w-full items-center gap-1.5 truncate border-l-2 border-[var(--gym-gold)]/50 pl-2 text-[11px] text-white/45"
                    onClick={() =>
                      document
                        .getElementById(`chat-msg-${m.parentMessageId}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "center" })
                    }
                  >
                    <Reply className="h-3 w-3 shrink-0" />
                    {m.parentPreview}
                  </button>
                ) : null}
                <div className="flex gap-2.5">
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      mine
                        ? "bg-[var(--gym-gold)]/20 text-[var(--gym-gold)]"
                        : "bg-white/10 text-white/80",
                    )}
                  >
                    {initials(m.author.displayName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-[13px] font-semibold text-white">
                        {m.author.displayName}
                      </span>
                      <span className="text-[10px] text-white/35">
                        {formatTime(m.createdAt)}
                        {m.editedAt ? " · edytowano" : ""}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "mt-0.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed",
                        m.deleted ? "italic text-white/35" : "text-white/85",
                      )}
                    >
                      {m.deleted
                        ? m.body
                        : highlightMentions(m.body, m.mentionUserIds)}
                    </p>
                    {!m.deleted && m.reactions.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {m.reactions.map((r) => (
                          <button
                            key={r.emoji}
                            type="button"
                            onClick={() => void toggleReaction(m.id, r.emoji)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] transition",
                              r.me
                                ? "border-[var(--gym-gold)]/45 bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]"
                                : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20",
                            )}
                          >
                            <span>{r.emoji}</span>
                            <span className="text-[10px] font-semibold">
                              {r.count}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                {!m.deleted ? (
                  <div className="absolute right-2 top-1.5 hidden items-center gap-0.5 rounded-xl border border-white/10 bg-[#15151a] p-0.5 shadow-lg group-hover:flex">
                    <button
                      type="button"
                      aria-label="Reakcja"
                      className="touch-target inline-flex items-center justify-center rounded-lg text-white/60 hover:bg-white/5 hover:text-white"
                      onClick={() =>
                        setEmojiFor((id) => (id === m.id ? null : m.id))
                      }
                    >
                      <Smile className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Odpowiedz"
                      className="touch-target inline-flex items-center justify-center rounded-lg text-white/60 hover:bg-white/5 hover:text-white"
                      onClick={() => setReplyTo(m)}
                    >
                      <Reply className="h-3.5 w-3.5" />
                    </button>
                    {mine ? (
                      <button
                        type="button"
                        aria-label="Usuń"
                        className="touch-target inline-flex items-center justify-center rounded-lg text-white/60 hover:bg-rose-500/20 hover:text-rose-300"
                        onClick={() => void deleteMessage(m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {emojiFor === m.id ? (
                  <div className="absolute right-2 top-10 z-10 flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-[#15151a] p-2 shadow-xl">
                    {CHAT_QUICK_EMOJI.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[16px] hover:bg-white/10"
                        onClick={() => {
                          void toggleReaction(m.id, emoji);
                          setEmojiFor(null);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="min-h-[1.25rem] px-3 pb-1 text-[11px] text-white/40">
        {typingLabel ?? "\u00A0"}
      </div>

      {replyTo ? (
        <div className="mx-3 mb-1 flex items-center gap-2 rounded-xl border border-[var(--gym-gold)]/25 bg-[var(--gym-gold)]/8 px-2.5 py-1.5">
          <Reply className="h-3.5 w-3.5 shrink-0 text-[var(--gym-gold)]" />
          <p className="min-w-0 flex-1 truncate text-[12px] text-white/70">
            <span className="font-semibold text-white">
              {replyTo.author.displayName}
            </span>
            : {replyTo.body.slice(0, 80)}
          </p>
          <button
            type="button"
            aria-label="Anuluj odpowiedź"
            onClick={() => setReplyTo(null)}
            className="text-white/45 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <div className="relative border-t border-white/8 bg-[#0e0e12] px-2.5 py-2.5">
        {mentionOpen && filteredMentions.length > 0 ? (
          <ul className="absolute bottom-full left-2 right-2 z-20 mb-1 overflow-hidden rounded-2xl border border-white/10 bg-[#15151a] shadow-2xl">
            {filteredMentions.map((m) => (
              <li key={m.userId}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-white/5"
                  onClick={() => insertMention(m.handle)}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white/80">
                    {initials(m.displayName)}
                  </span>
                  <span className="text-white">{m.displayName}</span>
                  <span className="text-white/40">@{m.handle}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {composerEmoji ? (
          <div className="mb-2 flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-[#15151a] p-2">
            {CHAT_QUICK_EMOJI.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[16px] hover:bg-white/10"
                onClick={() => {
                  setDraft((d) => d + emoji);
                  setComposerEmoji(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-end gap-1.5">
          <button
            type="button"
            aria-label="Emoji"
            onClick={() => setComposerEmoji((v) => !v)}
            className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white/55 hover:bg-white/5 hover:text-[var(--gym-gold)]"
          >
            <Smile className="h-5 w-5" />
          </button>
          <textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Napisz wiadomość… (@ do oznaczenia)"
            className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13.5px] text-white outline-none placeholder:text-white/35 focus:border-[var(--gym-gold)]/40"
          />
          <button
            type="button"
            aria-label="Wyślij"
            onClick={() => void submit()}
            disabled={!draft.trim()}
            className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--gym-gold)] text-black transition enabled:hover:brightness-110 disabled:opacity-35"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
