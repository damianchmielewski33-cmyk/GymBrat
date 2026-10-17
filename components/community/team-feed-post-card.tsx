"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  addTeamFeedCommentAction,
  deleteTeamFeedPostAction,
  setTeamFeedReactionAction,
  type TeamFeedActionState,
} from "@/actions/team-feed";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { screenInputClass } from "@/components/layout/screen";
import {
  FEED_REACTIONS,
  feedReactionMeta,
  type FeedReactionKind,
} from "@/lib/community/feed-reactions";
import { teamPostTypeLabel } from "@/lib/community/feed-types";
import type {
  TeamFeedComment,
  TeamFeedPost,
} from "@/lib/community/team-feed";
import { cn } from "@/lib/utils";

function formatTime(d: Date): string {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

function snapshotLine(post: TeamFeedPost): string | null {
  const s = post.snapshot;
  switch (post.type) {
    case "workout_complete": {
      const tonnage = s.tonnageKg != null ? `${s.tonnageKg} kg` : null;
      const sets = s.sets != null ? `${s.sets} serii` : null;
      return [tonnage, sets].filter(Boolean).join(" · ") || null;
    }
    case "personal_record":
      return s.e1rm != null
        ? `e1RM ${s.e1rm} kg · ${s.exerciseName ?? ""}`
        : String(s.exerciseName ?? "");
    case "achievement":
      return String(s.description ?? "");
    case "streak":
      return s.streakWeeks != null ? `${s.streakWeeks} tyg.` : null;
    case "level_up":
      return s.level != null ? `Poziom ${s.level}` : null;
    case "challenge_complete":
      return String(s.title ?? "");
    default:
      return null;
  }
}

export function TeamFeedPostCard({
  teamId,
  post,
  viewerUserId,
}: {
  teamId: string;
  post: TeamFeedPost;
  viewerUserId: string;
}) {
  const { notifyError, notifySaved } = useSaveFeedback();
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [comments, setComments] = useState(post.comments);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsHasMore, setCommentsHasMore] = useState(
    post.commentCount > post.comments.length,
  );

  useEffect(() => {
    setComments(post.comments);
    setCommentsHasMore(post.commentCount > post.comments.length);
  }, [post.comments, post.commentCount]);

  const [reactPending, startReact] = useTransition();
  const [myReaction, setMyReaction] = useState(post.myReaction);
  const [reactionBreakdown, setReactionBreakdown] = useState(
    post.reactionBreakdown,
  );

  useEffect(() => {
    setMyReaction(post.myReaction);
    setReactionBreakdown(post.reactionBreakdown);
  }, [post.id, post.myReaction, post.reactionBreakdown]);

  const [commentState, commentAction, commentPending] = useActionState(
    addTeamFeedCommentAction,
    {} as TeamFeedActionState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteTeamFeedPostAction,
    {} as TeamFeedActionState,
  );

  function applyReactionOptimistic(kind: FeedReactionKind) {
    const prev = myReaction;
    const next: FeedReactionKind | null = prev === kind ? null : kind;
    setReactionBreakdown((b) => {
      const copy: Partial<Record<FeedReactionKind, number>> = { ...b };
      if (prev) {
        const n = Math.max(0, (copy[prev] ?? 1) - 1);
        if (n === 0) delete copy[prev];
        else copy[prev] = n;
      }
      if (next) copy[next] = (copy[next] ?? 0) + 1;
      return copy;
    });
    setMyReaction(next);
    return { prev, next };
  }

  function onReact(kind: FeedReactionKind) {
    if (reactPending) return;
    const snapshot = {
      myReaction,
      reactionBreakdown: { ...reactionBreakdown },
    };
    applyReactionOptimistic(kind);
    startReact(async () => {
      const fd = new FormData();
      fd.set("teamId", teamId);
      fd.set("postId", post.id);
      fd.set("kind", kind);
      const result = await setTeamFeedReactionAction({}, fd);
      if (result.error) {
        setMyReaction(snapshot.myReaction);
        setReactionBreakdown(snapshot.reactionBreakdown);
        notifyError(result.error);
      }
    });
  }

  useEffect(() => {
    if (commentState.error) notifyError(commentState.error);
    if (commentState.ok) {
      setCommentBody("");
      setReplyTo(null);
      notifySaved("Komentarz dodany");
    }
  }, [commentState, notifyError, notifySaved]);

  useEffect(() => {
    if (deleteState.error) notifyError(deleteState.error);
    if (deleteState.ok) notifySaved("Wpis usunięty");
  }, [deleteState, notifyError, notifySaved]);

  const roots = useMemo(
    () => comments.filter((c) => !c.parentCommentId),
    [comments],
  );
  const repliesByParent = useMemo(() => {
    const map = new Map<string, TeamFeedComment[]>();
    for (const c of comments) {
      if (!c.parentCommentId) continue;
      const list = map.get(c.parentCommentId) ?? [];
      list.push(c);
      map.set(c.parentCommentId, list);
    }
    return map;
  }, [comments]);

  const loadOlderComments = async () => {
    if (loadingComments || !commentsHasMore) return;
    setLoadingComments(true);
    try {
      const oldest =
        comments.length > 0
          ? Math.min(...comments.map((c) => c.createdAt.getTime()))
          : Date.now();
      const res = await fetch(
        `/api/community/teams/${teamId}/feed/${post.id}/comments?before=${oldest}&limit=20`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        comments?: TeamFeedComment[];
        hasMore?: boolean;
      };
      const incoming = (data.comments ?? []).map((c) => ({
        ...c,
        createdAt: new Date(c.createdAt as unknown as string | number | Date),
      }));
      setComments((prev) => {
        const map = new Map(prev.map((c) => [c.id, c]));
        for (const c of incoming) map.set(c.id, c);
        return [...map.values()].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
        );
      });
      setCommentsHasMore(!!data.hasMore);
    } finally {
      setLoadingComments(false);
    }
  };

  const meta = snapshotLine(post);
  const canDelete = post.author.userId === viewerUserId;

  return (
    <article className="app-card space-y-3 p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-white">
            {post.author.displayName}
          </p>
          <p className="mt-0.5 text-[11px] text-white/40">
            {teamPostTypeLabel(post.type)} · {formatTime(post.createdAt)}
          </p>
        </div>
        {canDelete ? (
          <form action={deleteAction}>
            <input type="hidden" name="teamId" value={teamId} />
            <input type="hidden" name="postId" value={post.id} />
            <Button
              type="submit"
              size="xs"
              variant="ghost"
              disabled={deletePending}
            >
              Usuń
            </Button>
          </form>
        ) : null}
      </header>

      {post.body ? (
        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-white/90">
          {post.body}
        </p>
      ) : null}

      {meta ? (
        <p className="rounded-xl border border-[var(--gym-gold)]/20 bg-[var(--gym-gold)]/[0.06] px-3 py-2 text-[12px] text-[var(--gym-gold)]">
          {meta}
        </p>
      ) : null}

      {post.media.length > 0 ? (
        <div
          className={cn(
            "grid gap-2",
            post.media.length === 1 ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          {post.media.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={m.id}
              src={m.dataUrl}
              alt=""
              className="max-h-72 w-full rounded-xl object-cover"
            />
          ))}
        </div>
      ) : null}

      <div
        className="relative z-[1] flex flex-wrap gap-1.5 pointer-events-auto"
        role="group"
        aria-label="Reakcje"
      >
        {FEED_REACTIONS.map((r) => {
          const count = reactionBreakdown[r.kind] ?? 0;
          const active = myReaction === r.kind;
          return (
            <button
              key={r.kind}
              type="button"
              disabled={reactPending}
              title={r.label}
              aria-label={r.label}
              aria-pressed={active}
              onClick={() => onReact(r.kind)}
              className={cn(
                "inline-flex min-h-9 min-w-9 touch-manipulation items-center gap-1 rounded-full border px-2.5 py-1.5 text-[12px] transition-colors",
                "enabled:active:scale-[0.97] enabled:cursor-pointer disabled:opacity-55",
                active
                  ? "border-[var(--gym-gold)]/40 bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]"
                  : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]",
              )}
            >
              <span aria-hidden className="text-[15px] leading-none">
                {r.emoji}
              </span>
              {count > 0 ? (
                <span className="tabular-nums">{count}</span>
              ) : (
                <span className="text-[10px] uppercase tracking-wide opacity-70">
                  {r.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {myReaction ? (
        <p className="text-[11px] text-white/40">
          Twoja reakcja: {feedReactionMeta(myReaction).emoji}{" "}
          {feedReactionMeta(myReaction).label}
        </p>
      ) : null}

      <div className="space-y-2 border-t border-white/[0.06] pt-3">
        {commentsHasMore ? (
          <button
            type="button"
            disabled={loadingComments}
            onClick={() => void loadOlderComments()}
            className="text-[12px] font-semibold text-white/50 hover:text-white/80 disabled:opacity-50"
          >
            {loadingComments
              ? "Ładowanie…"
              : `Pokaż wcześniejsze komentarze (${post.commentCount})`}
          </button>
        ) : null}
        {roots.map((c) => (
          <div key={c.id} className="space-y-1.5">
            <div className="rounded-xl bg-white/[0.03] px-3 py-2">
              <p className="text-[12px] font-semibold text-white/80">
                {c.author.displayName}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-white/75">
                {c.body}
              </p>
              <button
                type="button"
                className="mt-1 text-[11px] font-semibold text-[var(--gym-gold)]"
                onClick={() => setReplyTo(c.id)}
              >
                Odpowiedz
              </button>
            </div>
            {(repliesByParent.get(c.id) ?? []).map((r) => (
              <div
                key={r.id}
                className="ml-4 rounded-xl border border-white/[0.05] bg-black/25 px-3 py-2"
              >
                <p className="text-[12px] font-semibold text-white/70">
                  {r.author.displayName}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-white/65">
                  {r.body}
                </p>
              </div>
            ))}
          </div>
        ))}

        <form action={commentAction} className="flex gap-2">
          <input type="hidden" name="teamId" value={teamId} />
          <input type="hidden" name="postId" value={post.id} />
          {replyTo ? (
            <input type="hidden" name="parentCommentId" value={replyTo} />
          ) : null}
          <Input
            name="body"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder={
              replyTo ? "Napisz odpowiedź… (@mention)" : "Skomentuj… (@mention)"
            }
            className={cn(screenInputClass, "min-h-10")}
            maxLength={1000}
          />
          <Button type="submit" size="sm" disabled={commentPending}>
            Wyślij
          </Button>
        </form>
        {replyTo ? (
          <button
            type="button"
            className="text-[11px] text-white/40"
            onClick={() => setReplyTo(null)}
          >
            Anuluj odpowiedź
          </button>
        ) : null}
      </div>
    </article>
  );
}
