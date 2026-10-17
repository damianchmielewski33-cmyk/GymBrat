import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Search, Ticket, Trophy, Users } from "lucide-react";
import { auth } from "@/auth";
import { CommunityEmptyState } from "@/components/community/community-empty-state";
import { PendingInviteActions } from "@/components/community/team-invite-forms";
import { JoinPublicTeamButton } from "@/components/community/team-invite-forms";
import { TeamCard } from "@/components/community/team-card";
import { AppPageHeader } from "@/components/layout/screen";
import { ThumbActionBar } from "@/components/layout/thumb-action-bar";
import { buttonVariants } from "@/components/ui/button";
import {
  listMyTeams,
  listPendingInvitesForUser,
  searchPublicTeams,
} from "@/lib/community/teams";
import { cn } from "@/lib/utils";

export default async function CommunityTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const params = await searchParams;
  const q = (params.q ?? "").trim();

  const [myTeams, publicTeams, pendingInvites] = await Promise.all([
    listMyTeams(userId),
    searchPublicTeams(q, userId),
    listPendingInvitesForUser(userId, session.user?.email ?? ""),
  ]);

  const discover = publicTeams.filter((t) => !t.isMember);

  return (
    <div className="space-y-6 pb-thumb-bar">
      <AppPageHeader
        kicker="Community"
        title="Teams"
        description="Trenuj razem — ranking tygodnia, live sesje, wyzwania i feed jak w Twojej drużynie."
      />

      <nav
        className="chip-scroll -mx-0.5 px-0.5"
        aria-label="Skróty Community"
      >
        <Link
          href="/community/challenges"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--gym-gold)]/25 bg-[var(--gym-gold)]/10 px-3.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--gym-gold)]"
        >
          <Trophy className="h-3.5 w-3.5" aria-hidden />
          Global Challenges
        </Link>
        <Link
          href="/community/notifications"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 text-[11px] font-semibold uppercase tracking-wide text-white/55"
        >
          Powiadomienia
        </Link>
      </nav>

      {pendingInvites.length > 0 ? (
        <section className="space-y-3" aria-labelledby="invites-heading">
          <h2 id="invites-heading" className="app-label text-[var(--gym-gold)]">
            Zaproszenia
          </h2>
          {pendingInvites.map((invite) => (
            <div
              key={invite.id}
              className="app-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-white">
                  <span aria-hidden>{invite.team.avatarEmoji}</span>{" "}
                  {invite.team.name}
                </p>
                <p className="mt-0.5 text-[12px] text-white/45">
                  {invite.team.memberCount} członków · rola {invite.role}
                </p>
              </div>
              <div className="flex w-full gap-2 sm:w-auto sm:min-w-[14rem]">
                <PendingInviteActions token={invite.token} />
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="my-teams-heading">
        <h2 id="my-teams-heading" className="app-label text-[var(--gym-gold)]">
          Moje grupy
        </h2>
        {myTeams.length === 0 ? (
          <CommunityEmptyState
            icon={<Users className="h-6 w-6" />}
            title="Jeszcze nie masz grupy"
            description="Utwórz Team albo dołącz kodem — ranking i live pojawią się od pierwszego treningu."
            action={
              <Link
                href="/community/teams/new"
                className={cn(
                  buttonVariants({ variant: "cta" }),
                  "inline-flex min-h-12 w-full",
                )}
              >
                Utwórz pierwszą grupę
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {myTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                href={`/community/teams/${team.id}`}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="discover-heading">
        <h2 id="discover-heading" className="app-label text-[var(--gym-gold)]">
          Szukaj publicznych
        </h2>
        <form className="relative" role="search">
          <label htmlFor="team-search" className="sr-only">
            Szukaj publicznych grup
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-white/35"
            aria-hidden
          />
          <input
            id="team-search"
            name="q"
            defaultValue={q}
            placeholder="Nazwa lub opis grupy"
            enterKeyHint="search"
            autoComplete="off"
            className="min-h-12 w-full rounded-2xl border border-white/20 bg-black/50 py-2.5 pr-4 pl-10 text-base text-white placeholder:text-white/40 outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/45 sm:text-sm"
          />
        </form>
        {discover.length === 0 ? (
          <p className="px-1 text-[13px] text-white/45" role="status">
            {q
              ? "Brak publicznych grup dla tego zapytania."
              : "Brak publicznych grup do odkrycia — utwórz pierwszą."}
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {discover.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                href={`/community/teams/${team.id}`}
                action={<JoinPublicTeamButton teamId={team.id} />}
              />
            ))}
          </div>
        )}
      </section>

      <ThumbActionBar>
        <Link
          href="/community/teams/join"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "min-h-12 flex-1 gap-2",
          )}
        >
          <Ticket className="h-4 w-4" aria-hidden />
          Kod
        </Link>
        <Link
          href="/community/teams/new"
          className={cn(
            buttonVariants({ variant: "cta" }),
            "min-h-12 flex-[1.4] gap-2",
          )}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nowa grupa
        </Link>
      </ThumbActionBar>
    </div>
  );
}
