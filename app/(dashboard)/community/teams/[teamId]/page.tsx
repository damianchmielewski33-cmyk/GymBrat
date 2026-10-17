import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { ChallengeCelebrationOverlay } from "@/components/community/challenge-celebration";
import { TeamDetailClient } from "@/components/community/team-detail-view";
import {
  listPendingCelebrations,
  listTeamChallenges,
} from "@/lib/community/challenges";
import { listTeamMentionCandidates } from "@/lib/community/feed-mentions";
import { listTeamFeed } from "@/lib/community/team-feed";
import { getTeamDetail } from "@/lib/community/teams";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const { teamId } = await params;
  const team = await getTeamDetail(teamId, userId);
  if (!team) notFound();

  const [feedPosts, mentionCandidates, challenges, celebrations] = team.isMember
    ? await Promise.all([
        listTeamFeed(teamId, userId, { limit: 12 }),
        listTeamMentionCandidates(teamId),
        listTeamChallenges(teamId, userId),
        listPendingCelebrations(userId),
      ])
    : [[], [], [], []];

  return (
    <div className="space-y-4">
      <ChallengeCelebrationOverlay celebrations={celebrations} />
      <Link
        href="/community/teams"
        className="inline-flex items-center gap-1.5 text-[13px] text-white/60 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Grupy
      </Link>
      <TeamDetailClient
        team={team}
        viewerUserId={userId}
        feedPosts={feedPosts}
        mentionCandidates={mentionCandidates}
        challenges={challenges}
      />
    </div>
  );
}
