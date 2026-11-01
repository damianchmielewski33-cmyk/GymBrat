"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dumbbell,
  Lock,
  Settings,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { TeamFcsLeaderboard } from "@/components/community/team-fcs-leaderboard";
import { ReputationBadge } from "@/components/community/reputation-badge";
import { leaveTeamAction, type TeamActionState } from "@/actions/teams";
import {
  InviteByEmailForm,
  JoinPublicTeamButton,
  RegenerateCodeButton,
  RevokeInviteButton,
} from "@/components/community/team-invite-forms";
import { ChallengeCard } from "@/components/community/challenge-card";
import { TeamFeedSection } from "@/components/community/team-feed-section";
import { TeamSubnav } from "@/components/community/team-subnav";
import { TeamTodayHubView } from "@/components/community/team-today-hub";
import { JoinGroupWorkoutButton } from "@/components/community/join-group-workout-button";
import { WorkoutChatPanel } from "@/components/community/workout-chat-panel";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { useTrackRankingViewed } from "@/hooks/use-track-community-once";
import { AppStatTile } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import type { ChallengeListItem } from "@/lib/community/challenges";
import type { MentionCandidate } from "@/lib/community/feed-mentions";
import type { TeamFeedPost } from "@/lib/community/team-feed";
import type { TeamTodayHub } from "@/lib/community/team-hub";
import type { TeamDetailView } from "@/lib/community/teams";
import {
  teamPrivacyLabel,
  teamRoleLabel,
} from "@/lib/community/team-types";
import { cn } from "@/lib/utils";

export function TeamDetailClient({
  team,
  viewerUserId,
  feedPosts,
  mentionCandidates,
  challenges,
  todayHub,
}: {
  team: TeamDetailView;
  viewerUserId: string;
  feedPosts: TeamFeedPost[];
  mentionCandidates: MentionCandidate[];
  challenges: ChallengeListItem[];
  todayHub: TeamTodayHub | null;
}) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [leaveState, leaveAction, leavePending] = useActionState(
    leaveTeamAction,
    {} as TeamActionState,
  );

  useEffect(() => {
    if (leaveState.error) notifyError(leaveState.error);
    if (leaveState.ok) {
      notifySaved("Opuszczono grupę");
      router.push("/community/teams");
    }
  }, [leaveState, notifyError, notifySaved, router]);

  useTrackRankingViewed({
    teamId: team.id,
    rankingMetric: team.rankingMetric,
    rankingSize: team.ranking.length,
    enabled: team.isMember,
  });

  return (
    <div className="space-y-5">
      {team.isMember ? <TeamSubnav teamId={team.id} /> : null}

      <section className="app-card overflow-hidden p-0">
        <div
          className="relative h-24 px-4 pt-4 sm:h-28"
          style={{
            background: `linear-gradient(145deg, ${team.bannerColor} 0%, #050505 90%)`,
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(212,175,55,0.18),transparent_55%)]" />
          <div className="relative inline-flex h-16 w-16 items-center justify-center rounded-3xl border border-white/15 bg-black/50 text-3xl shadow-xl backdrop-blur-sm">
            {team.avatarEmoji}
          </div>
        </div>
        <div className="space-y-3 px-4 pb-5 pt-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-heading text-[28px] font-semibold leading-tight tracking-tight text-white sm:text-[30px]">
                {team.name}
              </h1>
              <p className="mt-1.5 text-[12px] leading-relaxed text-white/50">
                {team.description || "Brak opisu grupy."}
              </p>
            </div>
            {team.canManage ? (
              <Link
                href={`/community/teams/${team.id}/settings`}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70 hover:text-white"
                aria-label="Ustawienia grupy"
              >
                <Settings className="h-4 w-4" />
              </Link>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                team.privacy === "public"
                  ? "border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10 text-[var(--gym-gold)]"
                  : "border-white/10 bg-white/[0.04] text-white/55",
              )}
            >
              {team.privacy === "private" ? (
                <Lock className="h-3 w-3" aria-hidden />
              ) : null}
              {teamPrivacyLabel(team.privacy)}
            </span>
            {team.myRole ? (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/70">
                Twoja rola: {teamRoleLabel(team.myRole)}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <AppStatTile value={team.memberCount} label="Członkowie" />
            <AppStatTile
              value={team.liveNow.length}
              label="Teraz trenuje"
              tone="mint"
            />
            <AppStatTile
              value={team.ranking.filter((r) => r.score > 0).length}
              label="Aktywni / tydz."
              tone="muted"
            />
          </div>

          {!team.isMember && team.privacy === "public" ? (
            <JoinPublicTeamButton teamId={team.id} />
          ) : null}

          {!team.isMember && team.privacy === "private" ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] text-white/55">
              To prywatna grupa. Dołącz kodem lub zaakceptuj zaproszenie e-mail.
            </p>
          ) : null}

          {team.isMember && team.myRole !== "owner" ? (
            <form action={leaveAction}>
              <input type="hidden" name="teamId" value={team.id} />
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={leavePending}
              >
                {leavePending ? "Wychodzenie…" : "Opuść grupę"}
              </Button>
            </form>
          ) : null}
        </div>
      </section>

      {team.isMember && todayHub ? <TeamTodayHubView hub={todayHub} /> : null}

      {team.canInvite && team.inviteCode ? (
        <section className="app-card space-y-3 p-5">
          <p className="app-label text-[var(--gym-gold)]">Zaproszenia</p>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] text-white/45">Kod grupy</p>
              <p className="font-mono text-xl tracking-[0.22em] text-white">
                {team.inviteCode}
              </p>
            </div>
            <RegenerateCodeButton teamId={team.id} />
          </div>
          <InviteByEmailForm teamId={team.id} />
          {team.pendingInvites.length > 0 ? (
            <div className="space-y-2 border-t border-white/[0.06] pt-3">
              <p className="text-[12px] font-semibold text-white/55">
                Oczekujące ({team.pendingInvites.length})
              </p>
              {team.pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">
                      {invite.inviteeName ?? invite.inviteeEmail}
                    </p>
                    <p className="text-[11px] text-white/40">
                      {teamRoleLabel(invite.role)}
                    </p>
                  </div>
                  <RevokeInviteButton
                    teamId={team.id}
                    invitationId={invite.id}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="app-card space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-300" aria-hidden />
            <h2 className="text-[15px] font-semibold text-white">
              Aktywne treningi
            </h2>
          </div>
          <span className="text-[12px] text-white/40">
            {team.liveGroupSessions.length || team.liveNow.length}
          </span>
        </div>

        {team.liveGroupSessions.length > 0 ? (
          <ul className="space-y-2">
            {team.liveGroupSessions.map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {session.title}
                  </p>
                  <p className="text-[11px] text-white/45">Trening grupowy · live</p>
                </div>
                {team.isMember ? (
                  <JoinGroupWorkoutButton sessionId={session.id} />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {team.liveNow.length === 0 && team.liveGroupSessions.length === 0 ? (
          <p className="text-[12px] leading-snug text-white/40">
            Nikt nie trenuje teraz.
          </p>
        ) : team.liveNow.length > 0 ? (
          <ul className="space-y-2">
            {team.liveNow.map((row) => (
              <li
                key={row.userId}
                className="flex items-center gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2.5"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <span className="text-sm font-medium text-white">
                  {row.displayName}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {team.isMember ? (
        <TeamFeedSection
          teamId={team.id}
          viewerUserId={viewerUserId}
          posts={feedPosts}
          mentionCandidates={mentionCandidates}
          canPost
        />
      ) : (
        <section className="app-card space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-white/70" aria-hidden />
            <h2 className="text-[15px] font-semibold text-white">Tablica grupy</h2>
          </div>
          <p className="text-[13px] leading-relaxed text-white/45">
            Dołącz do grupy, aby zobaczyć feed i publikować.
          </p>
        </section>
      )}

      {team.isMember ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <h2 className="text-[15px] font-semibold text-white">
              Workout Chat
            </h2>
            <span className="text-[11px] text-white/40">
              tap · nie zajmuje ekranu
            </span>
          </div>
          {/* Mobile: zwinięty — pełny panel zabiera ~70vh i wypycha feed poza thumb zone */}
          <WorkoutChatPanel
            target={{ kind: "team", teamId: team.id, title: team.name }}
            viewerUserId={viewerUserId}
            defaultOpen={false}
            className="w-full sm:w-auto"
          />
        </section>
      ) : null}

      <TeamFcsLeaderboard
        ranking={team.ranking}
        metric={team.rankingMetric}
      />

      <section className="app-card space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-[var(--gym-gold)]" aria-hidden />
          <h2 className="text-[15px] font-semibold text-white">Osiągnięcia</h2>
        </div>
        {team.achievementSummaries.length === 0 ? (
          <p className="text-[13px] text-white/45">
            Osiągnięcia grupy pojawią się wraz z aktywnością członków.
          </p>
        ) : (
          <ul className="grid gap-2">
            {team.achievementSummaries.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-[var(--gym-gold)]/20 bg-[var(--gym-gold)]/[0.06] px-3 py-2.5"
              >
                <p className="text-sm font-semibold text-[var(--gym-gold)]">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[12px] text-white/50">{item.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="app-card space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-white/70" aria-hidden />
            <h2 className="text-[15px] font-semibold text-white">Członkowie</h2>
          </div>
          {team.isMember ? (
            <Link
              href={`/community/teams/${team.id}/members`}
              className="text-[12px] font-semibold text-[var(--gym-gold)]"
            >
              Zarządzaj
            </Link>
          ) : null}
        </div>
        <ul className="space-y-1.5">
          {team.members.slice(0, 8).map((member) => (
            <li
              key={member.userId}
              className="flex items-center justify-between gap-2 rounded-xl px-2 py-2"
            >
              <span className="flex min-w-0 items-center gap-1.5 truncate text-sm text-white">
                <span className="truncate">{member.displayName}</span>
                {member.reputation ? (
                  <ReputationBadge
                    reputation={member.reputation}
                    size="xs"
                    className="shrink-0"
                  />
                ) : null}
              </span>
              <span className="shrink-0 text-[11px] uppercase tracking-wide text-white/40">
                {teamRoleLabel(member.role)}
              </span>
            </li>
          ))}
        </ul>
        {team.members.length > 8 ? (
          <p className="text-[12px] text-white/40">
            +{team.members.length - 8} więcej
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[var(--gym-gold)]" aria-hidden />
            <h2 className="text-[15px] font-semibold text-white">Wyzwania</h2>
          </div>
          {team.isMember ? (
            <Link
              href={`/community/teams/${team.id}/challenges`}
              className="text-[12px] font-semibold text-[var(--gym-gold)]"
            >
              Wszystkie
            </Link>
          ) : null}
        </div>
        {!team.isMember ? (
          <div className="app-card p-5 text-[13px] text-white/45">
            Dołącz do grupy, aby brać udział w wyzwaniach.
          </div>
        ) : challenges.length === 0 ? (
          <div className="app-card space-y-3 p-5">
            <p className="text-[13px] leading-relaxed text-white/45">
              Brak aktywnych wyzwań — uruchom 50 treningów, 100 km, 10k pompek
              albo 500 serii nóg.
            </p>
            {(team.myRole === "owner" ||
              team.myRole === "admin" ||
              team.myRole === "moderator") && (
              <Link
                href={`/community/teams/${team.id}/challenges/new`}
                className="inline-flex h-10 items-center justify-center rounded-2xl bg-[var(--gym-gold)] px-4 text-[13px] font-bold text-black"
              >
                Uruchom wyzwanie
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {challenges.slice(0, 3).map((c) => (
              <ChallengeCard
                key={c.id}
                challenge={c}
                teamId={team.id}
                href={`/community/teams/${team.id}/challenges/${c.id}`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
