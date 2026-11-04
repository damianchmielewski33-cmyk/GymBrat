import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { TeamMembersPanel } from "@/components/community/team-members-panel";
import { TeamSubnav } from "@/components/community/team-subnav";
import { AppPageHeader } from "@/components/layout/screen";
import { getFriendshipRelation } from "@/lib/community/friendships";
import { getTeamDetail } from "@/lib/community/teams";

export const metadata = { title: "Członkowie grupy" };

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
      <AppPageHeader
        backHref={`/community/teams/${teamId}`}
        backLabel={team.name}
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
