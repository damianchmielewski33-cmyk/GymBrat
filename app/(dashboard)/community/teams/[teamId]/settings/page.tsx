import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { TeamSettingsForm } from "@/components/community/team-settings-form";
import { AppPageHeader } from "@/components/layout/screen";
import { getTeamDetail } from "@/lib/community/teams";

export default async function TeamSettingsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const { teamId } = await params;
  const team = await getTeamDetail(teamId, userId);
  if (!team || !team.canManage) notFound();

  return (
    <div className="space-y-5">
      <Link
        href={`/community/teams/${teamId}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-white/60 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {team.name}
      </Link>
      <AppPageHeader
        kicker="Teams"
        title="Ustawienia grupy"
        description="Nazwa, banner, prywatność i metryka rankingu."
      />
      <TeamSettingsForm team={team} />
    </div>
  );
}
