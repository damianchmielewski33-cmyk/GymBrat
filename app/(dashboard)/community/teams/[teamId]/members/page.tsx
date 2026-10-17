import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { TeamMembersPanel } from "@/components/community/team-members-panel";
import { TeamSubnav } from "@/components/community/team-subnav";
import { AppPageHeader } from "@/components/layout/screen";
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
        kicker="Teams"
        title="Członkowie"
        description="Role: Owner · Admin · Moderator · Member"
      />
      <TeamMembersPanel
        teamId={team.id}
        viewerUserId={userId}
        viewerRole={team.myRole}
        members={team.members}
      />
    </div>
  );
}
