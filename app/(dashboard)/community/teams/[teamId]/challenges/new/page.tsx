import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { CreateChallengeForm } from "@/components/community/create-challenge-form";
import { listChallengeTemplates } from "@/lib/community/challenges";
import { getActiveMembership } from "@/lib/community/teams";
import { BackLink } from "@/components/ui/back-link";

export const metadata = { title: "Nowe wyzwanie grupy" };

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
      <BackLink href={`/community/teams/${teamId}/challenges`} label="Wyzwania" />
      <div>
        <h1 className="text-[length:var(--text-title-lg)] font-heading font-semibold text-white">
          Nowe wyzwanie
        </h1>
        <p className="mt-1 text-[13px] text-white/50">
          Szablony z gotowymi nagrodami XP i odznakami.
        </p>
      </div>
      <div className="app-card p-5">
        <CreateChallengeForm teamId={teamId} templates={templates} />
      </div>
    </div>
  );
}
