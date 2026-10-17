import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { auth } from "@/auth";
import { ChallengeCard } from "@/components/community/challenge-card";
import { ChallengeCelebrationOverlay } from "@/components/community/challenge-celebration";
import { TeamSubnav } from "@/components/community/team-subnav";
import { ThumbActionBar } from "@/components/layout/thumb-action-bar";
import {
  getActiveMembership,
} from "@/lib/community/teams";
import {
  listPendingCelebrations,
  listTeamChallenges,
} from "@/lib/community/challenges";

export default async function TeamChallengesPage({
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

  const [challenges, celebrations] = await Promise.all([
    listTeamChallenges(teamId, userId),
    listPendingCelebrations(userId),
  ]);

  const canCreate =
    membership.role === "owner" ||
    membership.role === "admin" ||
    membership.role === "moderator";

  return (
    <div className={canCreate ? "space-y-4 pb-thumb-bar" : "space-y-4"}>
      <ChallengeCelebrationOverlay celebrations={celebrations} />
      <TeamSubnav teamId={teamId} />
      <Link
        href={`/community/teams/${teamId}`}
        className="inline-flex min-h-10 items-center gap-1.5 text-[13px] text-white/60 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Team
      </Link>

      <div>
        <h1 className="font-heading text-[24px] font-semibold text-white sm:text-[26px]">
          Wyzwania Team
        </h1>
        <p className="mt-1 text-[13px] text-white/45">
          Indywidualne, grupowe i sezonowe — postęp, XP i odznaki.
        </p>
      </div>

      {challenges.length === 0 ? (
        <div className="app-card p-6 text-center">
          <p className="text-[14px] text-white/55">
            Brak aktywnych wyzwań w tej grupie.
          </p>
          {canCreate ? (
            <Link
              href={`/community/teams/${teamId}/challenges/new`}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--gym-gold)] px-4 text-[13px] font-bold text-black sm:w-auto"
            >
              Uruchom pierwsze wyzwanie
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {challenges.map((c) => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              teamId={teamId}
              href={`/community/teams/${teamId}/challenges/${c.id}`}
            />
          ))}
        </div>
      )}

      {canCreate ? (
        <ThumbActionBar>
          <Link
            href={`/community/teams/${teamId}/challenges/new`}
            className="inline-flex min-h-12 w-full flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--gym-gold)] px-4 text-[14px] font-bold text-black"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nowe wyzwanie
          </Link>
        </ThumbActionBar>
      ) : null}
    </div>
  );
}
