import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ChallengeCelebrationOverlay } from "@/components/community/challenge-celebration";
import { ChallengeDetailClient } from "@/components/community/challenge-detail-view";
import {
  getChallengeDetail,
  listPendingCelebrations,
} from "@/lib/community/challenges";

export default async function GlobalChallengeDetailPage({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const { challengeId } = await params;
  const [challenge, celebrations] = await Promise.all([
    getChallengeDetail(challengeId, userId),
    listPendingCelebrations(userId),
  ]);
  if (!challenge || challenge.scope !== "global") notFound();

  return (
    <>
      <ChallengeCelebrationOverlay celebrations={celebrations} />
      <ChallengeDetailClient
        challenge={challenge}
        viewerUserId={userId}
        backHref="/community/challenges"
      />
    </>
  );
}
