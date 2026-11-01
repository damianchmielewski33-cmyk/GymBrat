import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { BadgeCatalogClient } from "@/components/community/team-today-hub";
import { getBadgeCatalogForUser } from "@/lib/community/badge-catalog";
import { getTeamDetail } from "@/lib/community/teams";

export default async function TeamBadgesPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const { teamId } = await params;
  const team = await getTeamDetail(teamId, userId);
  if (!team || !team.isMember) notFound();

  const catalog = await getBadgeCatalogForUser(userId);

  return (
    <div className="space-y-4">
      <Link
        href={`/community/teams/${teamId}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-white/60 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {team.name}
      </Link>
      <BadgeCatalogClient
        teamId={teamId}
        items={catalog.items}
        unlockedCount={catalog.unlockedCount}
        totalCount={catalog.totalCount}
        suggestedKey={catalog.suggestedKey}
      />
    </div>
  );
}
