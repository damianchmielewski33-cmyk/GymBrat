"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowLeft, Target } from "lucide-react";
import { startTeamQuestAction } from "@/actions/community-quests";
import { TeamQuestProgressBar } from "@/components/community/quests/team-quest-progress-bar";
import { TeamQuestHistory } from "@/components/community/quests/team-quest-history";
import type { TeamQuestTemplate } from "@/lib/community/team-quest-types";
import type { getQuestBoardView, listQuestHistory } from "@/lib/community/team-quests";

type Board = Awaited<ReturnType<typeof getQuestBoardView>>;
type History = Awaited<ReturnType<typeof listQuestHistory>>;

export function TeamQuestBoard({
  teamId,
  board,
  history,
  templates,
}: {
  teamId: string;
  board: Board;
  history: History;
  templates: TeamQuestTemplate[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="space-y-5">
      <Link
        href={`/community/teams/${teamId}`}
        className="inline-flex min-h-10 items-center gap-1.5 text-[13px] text-white/60 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Grupa
      </Link>

      <header>
        <p className="app-label text-[var(--gym-gold)]">Team Quests</p>
        <h1 className="mt-1.5 flex items-center gap-2 font-heading text-[24px] font-semibold text-white">
          <Target className="h-6 w-6 text-[var(--gym-gold)]" />
          Misje zespołu
        </h1>
        <p className="mt-2 text-[13px] text-white/45">
          Cały zespół dokłada wkład z treningów. Jedna aktywna misja naraz.
        </p>
      </header>

      {board ? (
        <section className="app-card space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[22px]">{board.quest.emoji}</p>
              <h2 className="font-heading text-[18px] font-semibold text-white">
                {board.quest.title}
              </h2>
              <p className="mt-1 text-[12px] text-white/45">
                Do{" "}
                {board.quest.endsAt.toLocaleDateString("pl-PL", {
                  day: "numeric",
                  month: "short",
                })}
              </p>
            </div>
            <p className="font-metric text-[28px] text-[var(--gym-gold)]">
              {board.pct}%
            </p>
          </div>
          <TeamQuestProgressBar pct={board.pct} />
          <p className="text-[13px] text-white/55">
            {board.total.toLocaleString("pl-PL")} /{" "}
            {board.quest.targetValue.toLocaleString("pl-PL")}{" "}
            {board.quest.unitLabel}
          </p>
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-white/40">
              Wkład członków
            </p>
            {board.contributors.map((c, i) => (
              <div
                key={c.userId}
                className="flex items-center justify-between text-[13px]"
              >
                <span className={i === 0 ? "text-[var(--gym-gold)]" : "text-white/80"}>
                  {i === 0 ? "★ " : ""}
                  {c.displayName}
                </span>
                <span className="text-white/45">
                  {c.amount.toLocaleString("pl-PL")} {board.quest.unitLabel}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="app-card space-y-3 p-5">
          <p className="text-[14px] text-white/60">
            Brak aktywnej misji. Owner / Admin może uruchomić jedną z katalogu:
          </p>
          <div className="space-y-2">
            {templates.map((t) => (
              <button
                key={t.key}
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await startTeamQuestAction(teamId, t.key);
                    router.refresh();
                  })
                }
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition hover:border-[var(--gym-gold)]/35 disabled:opacity-50"
              >
                <span>
                  <span className="mr-2">{t.emoji}</span>
                  <span className="text-[14px] text-white">{t.title}</span>
                  <span className="mt-0.5 block text-[11px] text-white/40">
                    {t.durationDays} dni · +{t.rewardXpEach} XP
                  </span>
                </span>
                <span className="text-[12px] text-[var(--gym-gold)]">Start</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <TeamQuestHistory history={history} />
    </div>
  );
}
