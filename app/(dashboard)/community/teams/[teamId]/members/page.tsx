import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { TeamMembersPanel } from "@/components/community/team-members-panel";
import { TeamSubnav } from "@/components/community/team-subnav";
import { AppPageHeader } from "@/components/layout/screen";
import { getFriendshipRelation } from "@/lib/community/friendships";
import { getTeamDetail } from "@/lib/community/teams";

export default async function TeamMembersPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const { teamId } = await params;
  const team = await getTeamDetail(teamId, userId);
  if (!team || !team.isMember || !team.myRole) notFound();

  const friendshipStatusByUserId: Record<
    string,
    "none" | "pending" | "accepted" | "blocked"
  > = {};
  await Promise.all(
    team.members
      .filter((m) => m.userId !== userId)
      .map(async (m) => {
        friendshipStatusByUserId[m.userId] = await getFriendshipRelation(
          userId,
          m.userId,
        );
      }),
  );

  return (
    <div className="space-y-5">
      <TeamSubnav teamId={teamId} />
      <Link
        href={`/community/teams/${teamId}`}
        className="inline-flex min-h-10 items-center gap-1.5 text-[13px] text-white/60 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {team.name}
      </Link>
      <AppPageHeader
        kicker="Grupy"
        title="Członkowie"
        description="Role: Właściciel · Administrator · Moderator · Członek — możesz też dodać znajomego i udostępnić trening wzajemnie."
      />
      <TeamMembersPanel
        teamId={team.id}
        viewerUserId={userId}
        viewerRole={team.myRole}
        members={team.members}
        friendshipStatusByUserId={friendshipStatusByUserId}
      />
    </div>
  );
}
