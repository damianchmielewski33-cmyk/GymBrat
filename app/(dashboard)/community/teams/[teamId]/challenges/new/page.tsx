import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { CreateChallengeForm } from "@/components/community/create-challenge-form";
import { listChallengeTemplates } from "@/lib/community/challenges";
import { getActiveMembership } from "@/lib/community/teams";

export default async function NewTeamChallengePage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const { teamId } = await params;
  const membership = await getActiveMembership(teamId, userId);
  if (!membership) notFound();
  if (
    membership.role !== "owner" &&
    membership.role !== "admin" &&
    membership.role !== "moderator"
  ) {
    redirect(`/community/teams/${teamId}/challenges`);
  }

  const templates = listChallengeTemplates();

  return (
    <div className="space-y-4">
      <Link
        href={`/community/teams/${teamId}/challenges`}
        className="inline-flex items-center gap-1.5 text-[13px] text-white/60 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Wyzwania
      </Link>
      <div>
        <h1 className="font-heading text-[26px] font-semibold text-white">
          Nowe wyzwanie
        </h1>
        <p className="mt-1 text-[13px] text-white/45">
          Szablony z gotowymi nagrodami XP i odznakami.
        </p>
      </div>
      <div className="app-card p-5">
        <CreateChallengeForm teamId={teamId} templates={templates} />
      </div>
    </div>
  );
}
