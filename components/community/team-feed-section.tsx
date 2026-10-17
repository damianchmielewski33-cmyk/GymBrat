"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dumbbell } from "lucide-react";
import { useTeamFeedRealtime } from "@/hooks/use-team-feed-realtime";
import { CommunityEmptyState } from "@/components/community/community-empty-state";
import { TeamFeedComposer } from "@/components/community/team-feed-composer";
import { TeamFeedPostCard } from "@/components/community/team-feed-post-card";
import type { MentionCandidate } from "@/lib/community/feed-mentions";
import type { TeamFeedPost } from "@/lib/community/team-feed";

const PAGE = 12;

function normalizePosts(raw: TeamFeedPost[]): TeamFeedPost[] {
  return raw.map((p) => ({
    ...p,
    createdAt: new Date(p.createdAt as unknown as string | number | Date),
    comments: (p.comments ?? []).map((c) => ({
      ...c,
      createdAt: new Date(c.createdAt as unknown as string | number | Date),
    })),
  }));
}

export function TeamFeedSection({
  teamId,
  viewerUserId,
  posts: initialPosts,
  mentionCandidates,
  canPost,
}: {
  teamId: string;
  viewerUserId: string;
  posts: TeamFeedPost[];
  mentionCandidates: MentionCandidate[];
  canPost: boolean;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [hasMore, setHasMore] = useState(initialPosts.length >= PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPosts(initialPosts);
    setHasMore(initialPosts.length >= PAGE);
  }, [initialPosts]);

  const refreshHead = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/community/teams/${teamId}/feed?limit=${PAGE}`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          posts?: TeamFeedPost[];
          hasMore?: boolean;
        };
        if (!data.posts) return;
        const normalized = normalizePosts(data.posts);
        setPosts((prev) => {
          const headIds = new Set(normalized.map((p) => p.id));
          const older = prev.filter((p) => !headIds.has(p.id));
          return [...normalized, ...older].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
          );
        });
      } catch {
        /* ignore */
      }
    }, 280);
  }, [teamId]);

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  useTeamFeedRealtime(teamId, canPost, refreshHead);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || posts.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = posts[posts.length - 1]!.createdAt.getTime();
      const res = await fetch(
        `/api/community/teams/${teamId}/feed?before=${oldest}&limit=${PAGE}`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        posts?: TeamFeedPost[];
        hasMore?: boolean;
      };
      const normalized = normalizePosts(data.posts ?? []);
      setPosts((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        for (const p of normalized) map.set(p.id, p);
        return [...map.values()].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        );
      });
      setHasMore(!!data.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, posts, teamId]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  return (
    <section className="space-y-3" aria-labelledby="team-feed-heading">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h2
          id="team-feed-heading"
          className="text-[15px] font-semibold text-white"
        >
          Tablica grupy
        </h2>
        {canPost ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300/90">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span>Na żywo</span>
            <span className="sr-only">Aktualizacje w czasie rzeczywistym</span>
          </span>
        ) : null}
      </div>

      {canPost ? (
        <TeamFeedComposer
          teamId={teamId}
          mentionCandidates={mentionCandidates}
        />
      ) : (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] text-white/45">
          Dołącz do grupy, aby pisać na feedzie.
        </p>
      )}

      {posts.length === 0 ? (
        <CommunityEmptyState
          icon={<Dumbbell className="h-6 w-6" />}
          title="Tablica jest pusta"
          description="Ukończ trening albo napisz pierwszy post — tu pojawią się PR-y i wspólne momenty."
        />
      ) : (
        <div className="space-y-3" aria-live="polite" aria-relevant="additions">
          {posts.map((post) => (
            <TeamFeedPostCard
              key={post.id}
              teamId={teamId}
              post={post}
              viewerUserId={viewerUserId}
            />
          ))}
          <div ref={sentinelRef} className="h-4" aria-hidden />
          {loadingMore ? (
            <p className="py-2 text-center text-[12px] text-white/40" role="status">
              Ładowanie…
            </p>
          ) : null}
          {!hasMore && posts.length > PAGE ? (
            <p className="py-2 text-center text-[11px] text-white/30">
              Koniec feedu
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
