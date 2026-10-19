import {
  WAR_LEAGUE_META,
  type WarLeague,
} from "@/lib/community/team-war-types";

export function WarLeagueBadge({ league }: { league: WarLeague }) {
  const meta = WAR_LEAGUE_META[league];
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${meta.pillClass}`}
    >
      {meta.label}
    </span>
  );
}
