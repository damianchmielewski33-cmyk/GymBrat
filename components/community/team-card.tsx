import Link from "next/link";
import { Lock, Users } from "lucide-react";
import type { TeamListItem } from "@/lib/community/teams";
import { teamPrivacyLabel, teamRoleLabel } from "@/lib/community/team-types";
import { cn } from "@/lib/utils";

export function TeamCard({
  team,
  href,
  action,
}: {
  team: TeamListItem;
  href?: string;
  action?: React.ReactNode;
}) {
  const body = (
    <>
      <div
        className="relative h-16 overflow-hidden px-4 pt-3.5"
        style={{
          background: `linear-gradient(145deg, ${team.bannerColor} 0%, #050505 88%)`,
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(235,196,74,0.18),transparent_55%)]" />
        <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-black/55 text-2xl shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm">
          <span aria-hidden>{team.avatarEmoji}</span>
        </div>
      </div>
      <div className="space-y-2.5 px-4 pb-4 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-heading text-[17px] font-semibold tracking-tight text-white">
              {team.name}
            </h3>
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-white/45">
              {team.description || "Bez opisu — dołącz i ustaw ton grupy."}
            </p>
          </div>
          {team.privacy === "private" ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/50">
              <Lock className="h-3 w-3" aria-hidden />
              {teamPrivacyLabel(team.privacy)}
            </span>
          ) : (
            <span className="shrink-0 rounded-full border border-[var(--gym-gold)]/25 bg-[var(--gym-gold)]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--gym-gold)]">
              {teamPrivacyLabel(team.privacy)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5 text-[12px] text-white/45">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-white/35" aria-hidden />
            <span className="font-metric tabular-nums text-white/70">
              {team.memberCount}
            </span>
            <span className="text-white/30">/</span>
            <span className="tabular-nums">{team.maxMembers}</span>
          </span>
          {team.myRole ? (
            <span className="rounded-full bg-[var(--gym-gold)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--gym-gold)]">
              {teamRoleLabel(team.myRole)}
            </span>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <article
      className={cn(
        "app-card overflow-hidden p-0 transition-[border-color,transform,box-shadow] duration-200",
        href &&
          "hover:border-[var(--gym-gold)]/30 hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)] active:scale-[0.995]",
      )}
    >
      {href ? (
        <Link
          href={href}
          className="block rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
          aria-label={`Otwórz grupę ${team.name}`}
        >
          {body}
        </Link>
      ) : (
        body
      )}
      {action ? (
        <div className="border-t border-white/[0.06] px-4 py-3">{action}</div>
      ) : null}
    </article>
  );
}
