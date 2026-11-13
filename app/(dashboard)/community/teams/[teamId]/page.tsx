import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { ChallengeCelebrationOverlay } from "@/components/community/challenge-celebration";
import { TeamDetailClient } from "@/components/community/team-detail-view";
import {
  listPendingCelebrations,
  listTeamChallenges,
} from "@/lib/community/challenges";
import { listTeamMentionCandidates } from "@/lib/community/feed-mentions";
import { listTeamFeed } from "@/lib/community/team-feed";
import { getTeamTodayHub } from "@/lib/community/team-hub";
import { getTeamDetail } from "@/lib/community/teams";
import { BackLink } from "@/components/ui/back-link";

async function TeamCelebrations({ userId }: { userId: string }) {
  const celebrations = await listPendingCelebrations(userId);
  return <ChallengeCelebrationOverlay celebrations={celebrations} />;
}

export const metadata = { title: "Grupa" };

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

  const [feedPosts, mentionCandidates, challenges, todayHub] = team.isMember
    ? await Promise.all([
        listTeamFeed(teamId, userId, { limit: 12 }),
        listTeamMentionCandidates(teamId),
        listTeamChallenges(teamId, userId),
        getTeamTodayHub({
          teamId,
          userId,
          teamName: team.name,
        }),
      ])
    : [[], [], [], null];

  return (
    <div className="space-y-4">
      {/* Celebracje poza krytyczną ścieżką LCP — nie blokują tablicy. */}
      <Suspense fallback={null}>
        <TeamCelebrations userId={userId} />
      </Suspense>
      <BackLink href="/community/teams" label="Grupy" />
      <TeamDetailClient
        team={team}
        viewerUserId={userId}
        feedPosts={feedPosts}
        mentionCandidates={mentionCandidates}
        challenges={challenges}
        todayHub={todayHub}
      />
    </div>
  );
}
