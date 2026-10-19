import Link from "next/link";
import { redirect } from "next/navigation";
import { Swords, Trophy, Users } from "lucide-react";
import { auth } from "@/auth";
import { CommunityHubTabs } from "@/components/community/community-hub-tabs";
import { CommunityLevelBanner } from "@/components/community/progression-card";
import { listMyTeams } from "@/lib/community/teams";
import { getCommunityLevel } from "@/lib/community/progression";

export default async function CommunityHomePage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const [teams, community] = await Promise.all([
    listMyTeams(userId),
    getCommunityLevel(),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <p className="app-label text-[var(--gym-gold)]">Społeczność</p>
        <h1 className="mt-1.5 font-heading text-[26px] font-semibold text-white">
          Mój Team
        </h1>
        <p className="mt-2 text-[13px] text-white/45">
          Hub Twoich grup, wojen i misji — szybki start w Community.
        </p>
      </header>

      <CommunityHubTabs />
      <CommunityLevelBanner level={community.level} pct={community.pct} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/community/wars"
          className="app-card flex items-center gap-3 p-4 transition hover:border-rose-400/35"
        >
          <Swords className="h-5 w-5 text-rose-300" />
          <div>
            <p className="text-[14px] font-medium text-white">Wojny</p>
            <p className="text-[11px] text-white/40">Team Wars · FCS</p>
          </div>
        </Link>
        <Link
          href="/community/hall-of-fame"
          className="app-card flex items-center gap-3 p-4 transition hover:border-[var(--gym-gold)]/35"
        >
          <Trophy className="h-5 w-5 text-[var(--gym-gold)]" />
          <div>
            <p className="text-[14px] font-medium text-white">Galeria sławy</p>
            <p className="text-[11px] text-white/40">Hall of Fame</p>
          </div>
        </Link>
        <Link
          href="/community/challenges"
          className="app-card flex items-center gap-3 p-4 transition hover:border-white/25"
        >
          <Users className="h-5 w-5 text-white/70" />
          <div>
            <p className="text-[14px] font-medium text-white">Wyzwania</p>
            <p className="text-[11px] text-white/40">Global XP</p>
          </div>
        </Link>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-[17px] font-semibold text-white">
            Twoje grupy
          </h2>
          <Link
            href="/community/teams"
            className="text-[12px] text-[var(--gym-gold)]"
          >
            Wszystkie
          </Link>
        </div>
        {teams.length === 0 ? (
          <p className="text-[13px] text-white/40">
            Nie masz jeszcze grupy.{" "}
            <Link href="/community/teams/new" className="text-[var(--gym-gold)]">
              Utwórz
            </Link>
          </p>
        ) : (
          <ul className="space-y-2">
            {teams.slice(0, 6).map((t) => (
              <li key={t.id}>
                <Link
                  href={`/community/teams/${t.id}/quests`}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-white/25"
                >
                  <span className="text-[14px] text-white">
                    {t.avatarEmoji} {t.name}
                  </span>
                  <span className="text-[12px] text-white/40">Misje →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
