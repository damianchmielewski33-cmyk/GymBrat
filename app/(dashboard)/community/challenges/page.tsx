import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { auth } from "@/auth";
import { ChallengeCard } from "@/components/community/challenge-card";
import { ChallengeCelebrationOverlay } from "@/components/community/challenge-celebration";
import { CommunityEmptyState } from "@/components/community/community-empty-state";
import { CommunityProgress } from "@/components/community/community-progress";
import { ProgressionCard } from "@/components/community/progression-card";
import { ReputationCard } from "@/components/community/reputation-card";
import {
  getUserXpSummary,
  listGlobalChallenges,
  listPendingCelebrations,
} from "@/lib/community/challenges";
import { getUserProgressionView } from "@/lib/community/progression";
import { getUserReputation } from "@/lib/community/reputation";

export default async function GlobalChallengesPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const [challenges, celebrations, xp, reputation, progression] =
    await Promise.all([
      listGlobalChallenges(userId),
      listPendingCelebrations(userId),
      getUserXpSummary(userId),
      getUserReputation(userId),
      getUserProgressionView(userId),
    ]);

  return (
    <div className="space-y-5">
      <ChallengeCelebrationOverlay celebrations={celebrations} />

      <Link
        href="/community/teams"
        className="inline-flex min-h-10 items-center gap-1.5 text-[13px] text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/45"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Grupy
      </Link>

      <header>
        <p className="app-label text-[var(--gym-gold)]">Społeczność</p>
        <h1 className="mt-1.5 font-heading text-[24px] font-semibold tracking-tight text-white sm:text-[28px]">
          Wyzwania globalne
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-white/45">
          Cała społeczność GymBrat — wspólny postęp, XP, reputacja i odznaki.
        </p>
      </header>

      <ReputationCard reputation={reputation} />
      <ProgressionCard view={progression} />

      <section
        className="app-card relative overflow-hidden p-5"
        aria-labelledby="xp-heading"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(235,196,74,0.14),transparent_55%)]" />
        <div className="relative flex items-end justify-between gap-3">
          <div>
            <p id="xp-heading" className="text-[11px] uppercase tracking-wide text-white/40">
              Twój poziom
            </p>
            <p className="font-metric text-[40px] leading-none text-white">
              {xp.level}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-white/40">XP</p>
            <p className="font-metric text-[22px] text-[var(--gym-gold)]">
              {xp.xpTotal.toLocaleString("pl-PL")}
            </p>
          </div>
        </div>
        <div className="relative mt-4">
          <CommunityProgress
            value={xp.pct}
            label={`Postęp do poziomu ${xp.level + 1}: ${xp.pct}%`}
          />
          <p className="mt-2 text-[11px] text-white/40">
            {xp.intoLevel} / {xp.needForNext} XP do poziomu {xp.level + 1}
          </p>
        </div>
      </section>

      {challenges.length === 0 ? (
        <CommunityEmptyState
          icon={<Trophy className="h-6 w-6" />}
          title="Brak globalnych wyzwań"
          description="Wróć wkrótce — sezonowe cele społeczności pojawią się tutaj."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {challenges.map((c) => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              href={`/community/challenges/${c.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
