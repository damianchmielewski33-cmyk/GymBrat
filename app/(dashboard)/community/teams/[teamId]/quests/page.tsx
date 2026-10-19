import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TeamQuestBoard } from "@/components/community/quests/team-quest-board";
import {
  getQuestBoardView,
  listQuestHistory,
  listQuestTemplates,
} from "@/lib/community/team-quests";

export default async function TeamQuestsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const { teamId } = await params;

  const [board, history, templates] = await Promise.all([
    getQuestBoardView(teamId),
    listQuestHistory(teamId, 15),
    Promise.resolve(listQuestTemplates()),
  ]);

  return (
    <TeamQuestBoard
      teamId={teamId}
      board={board}
      history={history}
      templates={templates}
    />
  );
}
